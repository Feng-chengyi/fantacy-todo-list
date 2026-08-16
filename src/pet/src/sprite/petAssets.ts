/**
 * 桌宠精灵资产注册表（Codex 自定义宠物 v2 规范）。
 * 每角色一份 pet.json（帧布局与动画元数据）+ spritesheet.png（横排 15 帧）。
 * 资产由 scripts/gen-pets.mjs 生成，请勿手改 png。
 */
import type { PetCharacterId } from '../../../shared/types'

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

export const PET_ASSETS: Record<PetCharacterId, PetAsset> = {
  bubcat: { sheet: bubcatSheet, manifest: bubcatMeta as unknown as PetManifest },
  sprite: { sheet: spriteSheet, manifest: spriteMeta as unknown as PetManifest },
  bean: { sheet: beanSheet, manifest: beanMeta as unknown as PetManifest },
}

/** 单帧尺寸（192x208，全部角色一致） */
export const PET_FRAME_W = PET_ASSETS.bubcat.manifest.frame.width
export const PET_FRAME_H = PET_ASSETS.bubcat.manifest.frame.height
