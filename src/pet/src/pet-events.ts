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

/** 可交互热区（CSS px，相对窗口左上角） */
export interface PetHitBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * 模型尚未就绪时的兜底热区（居中偏下，覆盖模型大致站立区域）。
 * 仅用于模型加载完成前，加载完成后由 computePetHitBox 按实际尺寸重算。
 */
export const DEFAULT_PET_HIT_BOX: PetHitBox = { left: 106, top: 232, width: 108, height: 170 }

/**
 * 依据模型当前位置 / 实际尺寸 / 缩放，计算贴近轮廓的可交互热区。
 *
 * pixi-live2d-display 的 Live2DModel.width/height 已包含 model.scale，
 * anchor(0.5,0.5) 表示模型以中心对齐 model.x/model.y，故：
 *   左上角 = (model.x - w*anchor.x, model.y - h*anchor.y)
 * 再向内侧收缩，剔除模型四周的透明留白，避免命中区域过大挡住其它界面点击。
 */
export function computePetHitBox(model: Live2DModel): PetHitBox {
  const w = model.width
  const h = model.height
  const left = model.x - w * model.anchor.x
  const top = model.y - h * model.anchor.y

  const shrinkX = 0.88
  const shrinkY = 0.82
  const bw = w * shrinkX
  const bh = h * shrinkY

  return {
    left: Math.round(left + (w - bw) / 2),
    top: Math.round(top + (h - bh) / 2),
    width: Math.round(bw),
    height: Math.round(bh),
  }
}

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
