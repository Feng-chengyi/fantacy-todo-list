/**
 * 桌宠几何常量与热区计算（精灵帧 192x208，硬边像素风）。
 */

/** 单帧尺寸（CSS px，与 spritesheet 帧规格一致） */
export const PET_FRAME_BASE_W = 192
export const PET_FRAME_BASE_H = 208

/** 滚轮缩放范围（最小 / 最大限制，防止过大或过小） */
export const SCALE_MIN = 0.3
export const SCALE_MAX = 1.6

/** 缩放倍数钳制到 [SCALE_MIN, SCALE_MAX] */
export function clampScale(scale: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale))
}

/** 拖拽阈值（像素），小于该位移视为点击 */
export const DRAG_THRESHOLD = 4

/** 可交互热区（CSS px，相对窗口左上角） */
export interface PetHitBox {
  left: number
  top: number
  width: number
  height: number
}

/** 依据缩放计算居中贴合角色的可交互热区（纯几何） */
export function computeHitBox(scale: number): PetHitBox {
  const w = Math.round(PET_FRAME_BASE_W * scale)
  const h = Math.round(PET_FRAME_BASE_H * scale)
  return {
    left: Math.round((window.innerWidth - w) / 2),
    top: Math.round((window.innerHeight - h) / 2),
    width: w,
    height: h,
  }
}

export const DEFAULT_PET_HIT_BOX: PetHitBox = computeHitBox(1)
