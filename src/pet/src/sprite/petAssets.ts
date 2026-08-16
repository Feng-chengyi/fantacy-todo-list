/**
 * 桌宠精灵资产注册表（Codex 自定义宠物 v2 规范）。
 * 每角色一份 pet.json（帧布局与动画元数据）+ spritesheet.png（横排 15 帧）。
 * 内置资产由 scripts/gen-pets.mjs 生成，请勿手改 png；
 * 用户导入的自定义宠物包在运行时由 loadCustomPets 从主进程拉取并合并进注册表。
 */
import type { PetCharacterId, PetPackEntry, PetPackManifest } from '../../../shared/types'
import { PET_CHARACTERS } from '../../../shared/defaults'
import { PET_FRAME_COUNT, PET_FRAME_H as SHEET_FRAME_H, PET_FRAME_W as SHEET_FRAME_W } from '../../../shared/petPack'

import bubcatSheet from '../../assets/bubcat/spritesheet.png'
import bubcatMeta from '../../assets/bubcat/pet.json'
import spriteSheet from '../../assets/sprite/spritesheet.png'
import spriteMeta from '../../assets/sprite/pet.json'
import beanSheet from '../../assets/bean/spritesheet.png'
import beanMeta from '../../assets/bean/pet.json'

/** 动画名（与 pet.json animations 键一致） */
export type PetAnim =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'timing'
  | 'finishing'

export interface PetAnimationMeta {
  frames: number[]
  fps: number
  loop: boolean
}

export interface PetManifest {
  frame: { width: number; height: number }
  spritesheet: { frameCount: number }
  animations: Record<PetAnim, PetAnimationMeta>
}

export interface PetAsset {
  sheet: string
  manifest: PetManifest
}

/** 编译期静态内置资产（三员，横排帧表与 sheet 由构建管线注入） */
export const BUILTIN_ASSETS: Record<PetCharacterId, PetAsset> = {
  bubcat: { sheet: bubcatSheet, manifest: bubcatMeta as unknown as PetManifest },
  sprite: { sheet: spriteSheet, manifest: spriteMeta as unknown as PetManifest },
  bean: { sheet: beanSheet, manifest: beanMeta as unknown as PetManifest },
}

/**
 * 运行时可变注册表：内置快照 + 自定义宠物包动态合并（loadCustomPets 写入）。
 * 模块私有，外部一律经 getPetAssets() 同步读取，避免直接持有可变绑定。
 */
let PET_ASSETS: Record<PetCharacterId, PetAsset> = { ...BUILTIN_ASSETS }

/** 同步读取当前资产注册表（内置 + 已合并的自定义宠物） */
export function getPetAssets(): Record<PetCharacterId, PetAsset> {
  return PET_ASSETS
}

/** 单帧尺寸（192x208，全部角色一致；与 shared/petPack 常量同源，自定义包按此校验） */
export const PET_FRAME_W = SHEET_FRAME_W
export const PET_FRAME_H = SHEET_FRAME_H

/** 自定义宠物信息（id + 显示名，切换菜单渲染用） */
export interface CustomPetInfo {
  id: string
  name: string
}

/** 自定义宠物 id → 显示名映射（loadCustomPets 成功加载时填充） */
const customPetNames = new Map<string, string>()

/** 七个动画键全集（与 pet.json animations 键一致，适配时逐键检查） */
const PET_ANIM_KEYS: PetAnim[] = [
  'idle',
  'running-right',
  'running-left',
  'waving',
  'jumping',
  'timing',
  'finishing',
]

/** 最终兜底 idle 帧表（清单连 idle 键都缺失 / 畸形时使用） */
const FALLBACK_IDLE_META: PetAnimationMeta = { frames: [0], fps: 4, loop: true }

/** 校验单条动画元数据结构：帧索引须为 0-14 内的整数、fps ≥ 1、loop 为布尔 */
function isAnimMeta(v: unknown): v is PetAnimationMeta {
  if (typeof v !== 'object' || v === null) return false
  const a = v as Record<string, unknown>
  if (!Array.isArray(a.frames) || a.frames.length === 0) return false
  for (const f of a.frames) {
    if (typeof f !== 'number' || !Number.isInteger(f) || f < 0 || f > PET_FRAME_COUNT - 1) return false
  }
  return typeof a.fps === 'number' && a.fps >= 1 && typeof a.loop === 'boolean'
}

/**
 * 将宠物包清单（PetPackManifest，与内部 PetManifest 结构兼容）适配为 PetManifest：
 * - 断言 frame 192x208、spritesheet.frameCount 15，不符返回 null（调用方静默跳过）；
 * - animations 七键逐键校验：存在且合法则填入，缺失 / 畸形键回落 idle 帧表。
 */
function adaptPackManifest(v: unknown): PetManifest | null {
  if (typeof v !== 'object' || v === null) return null
  const m = v as PetPackManifest
  if (m.frame?.width !== PET_FRAME_W || m.frame?.height !== PET_FRAME_H) return null
  const frameCount = m.spritesheet?.frameCount
  if (frameCount !== PET_FRAME_COUNT) return null
  const animations = {} as Record<PetAnim, PetAnimationMeta>
  // idle 键合法则作为其余缺失键的回落帧表，否则用单帧兜底
  const idle = isAnimMeta(m.animations?.idle) ? m.animations.idle : FALLBACK_IDLE_META
  for (const key of PET_ANIM_KEYS) {
    animations[key] = isAnimMeta(m.animations?.[key]) ? m.animations[key] : idle
  }
  return {
    frame: { width: PET_FRAME_W, height: PET_FRAME_H },
    spritesheet: { frameCount },
    animations,
  }
}

/**
 * 运行时加载自定义宠物包并合并进注册表：
 * 调用主进程 petPackList（每条含 meta / sheetDataUrl / manifest），逐条校验后
 * 写入 PET_ASSETS[id]；meta / sheet / manifest 任一不合法的条目静默跳过（不 console）。
 * 返回可用的 { id, name } 列表（供切换菜单渲染）。
 */
export async function loadCustomPets(): Promise<CustomPetInfo[]> {
  const list: CustomPetInfo[] = []
  let entries: PetPackEntry[] = []
  try {
    entries = await window.petApi.petPackList()
  } catch {
    // 桥接不可用（异常环境）：按无自定义宠物处理，不影响内置角色
    return list
  }
  for (const entry of entries) {
    const id = entry.meta?.id
    const name = entry.meta?.name
    if (typeof id !== 'string' || id === '' || typeof name !== 'string' || name === '') continue
    if (typeof entry.sheetDataUrl !== 'string' || entry.sheetDataUrl === '') continue
    const manifest = adaptPackManifest(entry.manifest)
    if (!manifest) continue
    PET_ASSETS[id] = { sheet: entry.sheetDataUrl, manifest }
    customPetNames.set(id, name)
    list.push({ id, name })
  }
  return list
}

/** 查角色显示名：内置查 PET_CHARACTERS，自定义查 loadCustomPets 填充的映射；未知返回 null */
export function getPetName(id: string): string | null {
  const builtin = PET_CHARACTERS.find((m) => m.id === id)
  if (builtin) return builtin.name
  return customPetNames.get(id) ?? null
}
