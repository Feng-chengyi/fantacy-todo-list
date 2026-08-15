/**
 * 桌宠交互辅助：缩放钳制、拖拽阈值、点击动作组选择。
 */
import type { Live2DModel } from 'pixi-live2d-display'

/** 滚轮缩放范围（默认尺寸已整体缩小约一半，允许 0.3 ~ 1.5 倍继续缩放） */
export const SCALE_MIN = 0.3
export const SCALE_MAX = 1.5

/** 缩放倍数钳制到 [SCALE_MIN, SCALE_MAX] */
export function clampScale(scale: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale))
}

/** 拖拽阈值（像素），小于该位移视为点击 */
export const DRAG_THRESHOLD = 4

/**
 * 依据模型实际 Motions 分组选择一个「点击响应」动作组。
 * 优先选择非 idle 组（Haru/Hiyori/Natori 均为 "TapBody"），缺失时回退到 idle 组。
 * 读取 model3.json 中真实存在的分组名，避免硬编码 "Tap" 这类不存在的组导致点击无反应。
 */
export function pickTapMotionGroup(model: Live2DModel): string {
  const manager = model.internalModel?.motionManager
  const groups = manager ? Object.keys(manager.motionGroups ?? {}) : []
  if (groups.length === 0) return 'Idle'

  const idleGroup = manager!.groups.idle
  const tapGroups = groups.filter((g) => g !== idleGroup)
  const pool = tapGroups.length > 0 ? tapGroups : groups
  const chosen = pool[Math.floor(Math.random() * pool.length)]
  return chosen ?? idleGroup
}
