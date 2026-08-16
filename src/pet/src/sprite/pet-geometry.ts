/**
 * 桌宠几何常量与热区计算：复用 shared/petWindow 的 computeSpriteBox，
 * 精灵盒即热区（顶部锚定 PET_WINDOW_PAD.top、水平居中）。
 */
import { computeSpriteBox, type SpriteBox } from '../../../shared/petWindow'

/** 滚轮缩放范围（最小 / 最大限制，防止过大或过小） */
export const SCALE_MIN = 0.3
export const SCALE_MAX = 1.6

/** 缩放倍数钳制到 [SCALE_MIN, SCALE_MAX] */
export function clampScale(scale: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale))
}

/** 拖拽阈值（像素），小于该位移视为点击 */
export const DRAG_THRESHOLD = 4

/** 可交互热区（CSS px，相对窗口左上角）；与精灵盒同形 */
export type PetHitBox = SpriteBox

/** 依据帧尺寸 + 缩放 + 视口宽计算贴合角色的可交互热区（纯几何，复用 computeSpriteBox） */
export function computeHitBox(frameW: number, frameH: number, scale: number, viewportW: number): PetHitBox {
  return computeSpriteBox(frameW, frameH, scale, viewportW)
}
