/**
 * 桌宠窗口几何纯函数（无 IO / 无 DOM / 无 electron）：
 * - 依据角色帧尺寸 + 缩放计算窗口所需尺寸与精灵盒位置；
 * - 屏幕感知钳制：把浮层/气泡/菜单在屏幕边缘自动平移，桌宠本体不钳制。
 */
import type { WorkAreaRect } from './types'

/** 桌宠窗口内边距：上方（气泡/浮层，需容纳最高 220 的浮层 + 间距）、下方（徽标）、左右（菜单）预留空间 */
export const PET_WINDOW_PAD = {
  top: 240,
  right: 64,
  bottom: 72,
  left: 64,
} as const

/** 桌宠窗口最小尺寸（DIP），默认缩放（scale=1）下正好 320×520，防极端缩放下窗口坍缩 */
export const PET_WINDOW_MIN = { width: 320, height: 520 } as const

/** 二维尺寸 */
export interface Size2D {
  width: number
  height: number
}

/** 精灵盒（窗口内定位矩形，与主窗口热区同形） */
export interface SpriteBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * 计算桌宠窗口所需尺寸 = 缩放后帧尺寸 + 内边距（同时受最小尺寸保护）。
 */
export function computePetWindowSize(frameW: number, frameH: number, scale: number): Size2D {
  const w = Math.max(1, Math.round(frameW * scale))
  const h = Math.max(1, Math.round(frameH * scale))
  return {
    width: Math.max(PET_WINDOW_MIN.width, w + PET_WINDOW_PAD.left + PET_WINDOW_PAD.right),
    height: Math.max(PET_WINDOW_MIN.height, PET_WINDOW_PAD.top + h + PET_WINDOW_PAD.bottom),
  }
}

/**
 * 计算精灵盒在窗口内的位置：顶部锚定 PET_WINDOW_PAD.top，水平居中。
 * 当窗口尺寸与 computePetWindowSize 一致时，left 恒等于 PET_WINDOW_PAD.left。
 */
export function computeSpriteBox(
  frameW: number,
  frameH: number,
  scale: number,
  viewportW: number,
): SpriteBox {
  const w = Math.max(1, Math.round(frameW * scale))
  const h = Math.max(1, Math.round(frameH * scale))
  return {
    left: Math.round((viewportW - w) / 2),
    top: PET_WINDOW_PAD.top,
    width: w,
    height: h,
  }
}

/** 单轴钳制：把 [pos, pos+size] 平移到 [areaPos, areaPos+areaSize] 内（不缩放） */
function clampAxis(pos: number, size: number, areaPos: number, areaSize: number): number {
  if (pos < areaPos) return areaPos
  if (pos + size > areaPos + areaSize) return Math.max(areaPos, areaPos + areaSize - size)
  return pos
}

/**
 * 屏幕感知钳制：把「屏幕坐标」矩形平移到显示器工作区内（仅平移、不改变宽高）。
 * 用于浮层/气泡/菜单在屏幕边缘时自动回移，保证完全可见；桌宠本体不调用此钳制。
 */
export function screenAwareClamp(rect: WorkAreaRect, workArea: WorkAreaRect): WorkAreaRect {
  return {
    x: clampAxis(rect.x, rect.width, workArea.x, workArea.width),
    y: clampAxis(rect.y, rect.height, workArea.y, workArea.height),
    width: rect.width,
    height: rect.height,
  }
}

/**
 * 计算「屏幕感知平移量」：给定元素在窗口内的局部矩形 + 窗口屏幕坐标 + 工作区，
 * 返回把该元素平移回工作区内所需的 { dx, dy }（元素不改变大小）。
 */
export function screenAwareOffset(
  local: { x: number; y: number; width: number; height: number },
  winPos: { x: number; y: number },
  workArea: WorkAreaRect,
): { dx: number; dy: number } {
  const rect: WorkAreaRect = {
    x: winPos.x + local.x,
    y: winPos.y + local.y,
    width: local.width,
    height: local.height,
  }
  const clamped = screenAwareClamp(rect, workArea)
  return { dx: clamped.x - rect.x, dy: clamped.y - rect.y }
}
