/**
 * 自定义宠物包共享常量与清单校验（纯函数，无 IO）。
 * spritesheet 规格：单帧 192x208，15 帧横排 → 2880x208。
 */
import type { PetPackAnim, PetPackManifest } from './types'

/** 单帧宽度（px） */
export const PET_FRAME_W = 192
/** 单帧高度（px） */
export const PET_FRAME_H = 208
/** 帧数 */
export const PET_FRAME_COUNT = 15
/** spritesheet 总宽 = 单帧宽 × 帧数（2880） */
export const PET_SHEET_W = PET_FRAME_W * PET_FRAME_COUNT
/** spritesheet 总高 = 单帧高（208） */
export const PET_SHEET_H = PET_FRAME_H

/** 宠物包动画键全集（7 组，与运行时一致） */
export const PET_PACK_ANIMS: PetPackAnim[] = [
  'idle',
  'running-right',
  'running-left',
  'waving',
  'jumping',
  'timing',
  'finishing',
]

/**
 * 名称 → 合法 pet-id。
 * 规则：转小写；中文/非 ASCII 保留；空白（含全角空格）→ '-'；
 * 丢弃控制符与 ASCII 标点（含非法路径字符 /\:*?"<>|）；
 * 合并连续 '-'、去首尾 '-'；结果为空返回 'pet'；按码点截断 40 字符。
 */
export function normalizePetId(name: string): string {
  let out = ''
  for (const ch of name.toLowerCase()) {
    const code = ch.codePointAt(0) ?? 0
    if (/\s/.test(ch)) {
      // 各类空白统一转分隔符
      out += '-'
    } else if (ch === '-' || ch === '_') {
      // 常见 slug 字符保留
      out += ch
    } else if ((code >= 0x30 && code <= 0x39) || (code >= 0x61 && code <= 0x7a)) {
      // ASCII 数字与小写字母保留
      out += ch
    } else if (code > 0x7f) {
      // 中文等非 ASCII 保留
      out += ch
    }
    // 其余（控制符与 ASCII 标点，含 /\:*?"<>|）直接丢弃
  }
  // 合并连续分隔符并去首尾
  out = out.replace(/-+/g, '-').replace(/^-+|-+$/g, '')
  if (!out) return 'pet'
  // 按码点截断，避免劈开代理对
  return Array.from(out).slice(0, 40).join('')
}

/**
 * 严格校验宠物包清单（pet.json）。
 * 通过返回归一后的 manifest；失败返回中文错误信息（供 UI 直接提示）。
 */
export function validatePetPackManifest(
  v: unknown
): { ok: true; manifest: PetPackManifest } | { ok: false; error: string } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return { ok: false, error: '清单必须是 JSON 对象' }
  }
  const m = v as Record<string, unknown>
  if (m.formatVersion !== 2) {
    return { ok: false, error: `formatVersion 必须为 2，实际为 ${String(m.formatVersion)}` }
  }
  if (m.spec !== 'codex-custom-pet-v2') {
    return { ok: false, error: `spec 必须为 codex-custom-pet-v2，实际为 ${String(m.spec)}` }
  }
  if (typeof m.id !== 'string' || m.id.trim().length === 0) {
    return { ok: false, error: 'id 必须为非空字符串' }
  }
  const normalizedId = normalizePetId(m.id)
  if (normalizedId.includes('/') || normalizedId.includes('\\')) {
    return { ok: false, error: 'id 归一化后不得含路径分隔符' }
  }
  if (typeof m.name !== 'string' || m.name.trim().length === 0) {
    return { ok: false, error: 'name 必须为非空字符串' }
  }
  const frame = m.frame
  if (
    typeof frame !== 'object' ||
    frame === null ||
    (frame as Record<string, unknown>).width !== PET_FRAME_W ||
    (frame as Record<string, unknown>).height !== PET_FRAME_H
  ) {
    return { ok: false, error: `frame 必须为 ${PET_FRAME_W}x${PET_FRAME_H}` }
  }
  const sheet = m.spritesheet
  if (typeof sheet !== 'object' || sheet === null) {
    return { ok: false, error: 'spritesheet 必须为对象' }
  }
  const s = sheet as Record<string, unknown>
  if (typeof s.file !== 'string' || s.file.length === 0) {
    return { ok: false, error: 'spritesheet.file 必须为非空字符串' }
  }
  if (s.layout !== 'horizontal') {
    return { ok: false, error: `spritesheet.layout 必须为 horizontal，实际为 ${String(s.layout)}` }
  }
  if (s.frameCount !== PET_FRAME_COUNT) {
    return { ok: false, error: `spritesheet.frameCount 必须为 ${PET_FRAME_COUNT}，实际为 ${String(s.frameCount)}` }
  }
  const anims = m.animations
  if (typeof anims !== 'object' || anims === null || Array.isArray(anims)) {
    return { ok: false, error: 'animations 必须为对象' }
  }
  for (const key of PET_PACK_ANIMS) {
    const a = (anims as Record<string, unknown>)[key]
    if (typeof a !== 'object' || a === null) {
      return { ok: false, error: `animations.${key} 缺失或非对象` }
    }
    const rec = a as Record<string, unknown>
    if (!Array.isArray(rec.frames) || rec.frames.length === 0) {
      return { ok: false, error: `animations.${key}.frames 必须为非空数组` }
    }
    for (const f of rec.frames) {
      if (typeof f !== 'number' || !Number.isInteger(f) || f < 0 || f > PET_FRAME_COUNT - 1) {
        return {
          ok: false,
          error: `animations.${key}.frames 帧索引必须为 0-${PET_FRAME_COUNT - 1} 内的整数`,
        }
      }
    }
    if (typeof rec.fps !== 'number' || !(rec.fps >= 1)) {
      return { ok: false, error: `animations.${key}.fps 必须为 ≥ 1 的数字` }
    }
    if (typeof rec.loop !== 'boolean') {
      return { ok: false, error: `animations.${key}.loop 必须为布尔值` }
    }
  }
  return { ok: true, manifest: m as unknown as PetPackManifest }
}

/** 校验 spritesheet 像素尺寸是否为 2880x208 */
export function validatePetSheetSize(w: number, h: number): boolean {
  return w === PET_SHEET_W && h === PET_SHEET_H
}
