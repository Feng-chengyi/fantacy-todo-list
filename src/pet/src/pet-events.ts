/**
 * 桌宠交互辅助：缩放钳制、随机动作组选择。
 */
export const SCALE_MIN = 0.5
export const SCALE_MAX = 2.0

/** 缩放倍数钳制到 [0.5, 2.0] */
export function clampScale(scale: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale))
}

/** 随机选择一个动作组（Tap / Idle） */
export function pickMotionGroup(): 'Tap' | 'Idle' {
  return Math.random() < 0.5 ? 'Tap' : 'Idle'
}

/** 拖拽阈值（像素），小于该位移视为点击 */
export const DRAG_THRESHOLD = 4
