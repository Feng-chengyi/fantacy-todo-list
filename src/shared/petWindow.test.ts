/**
 * petWindow 几何纯函数单测：窗口尺寸 / 精灵盒 / 屏幕感知钳制。
 */
import { describe, expect, it } from 'vitest'
import {
  PET_WINDOW_MIN,
  PET_WINDOW_PAD,
  computePetWindowSize,
  computeSpriteBox,
  screenAwareClamp,
  screenAwareOffset,
} from './petWindow'

describe('computePetWindowSize', () => {
  it('窗口 = 缩放帧 + 内边距', () => {
    const s = computePetWindowSize(192, 208, 1)
    expect(s.width).toBe(192 + PET_WINDOW_PAD.left + PET_WINDOW_PAD.right)
    expect(s.height).toBe(PET_WINDOW_PAD.top + 208 + PET_WINDOW_PAD.bottom)
  })
  it('缩放按整数四舍五入', () => {
    const s = computePetWindowSize(192, 208, 1.5)
    expect(s.width).toBe(288 + PET_WINDOW_PAD.left + PET_WINDOW_PAD.right)
    expect(s.height).toBe(PET_WINDOW_PAD.top + 312 + PET_WINDOW_PAD.bottom)
  })
  it('极端缩放下受最小尺寸保护', () => {
    const s = computePetWindowSize(192, 208, 0.1)
    expect(s.width).toBeGreaterThanOrEqual(PET_WINDOW_MIN.width)
    expect(s.height).toBeGreaterThanOrEqual(PET_WINDOW_MIN.height)
  })
})

describe('computeSpriteBox', () => {
  it('顶部锚定 PAD.top、水平居中', () => {
    const w = 320
    const box = computeSpriteBox(192, 208, 1, w)
    expect(box.top).toBe(PET_WINDOW_PAD.top)
    expect(box.left).toBe(Math.round((w - 192) / 2))
    expect(box.width).toBe(192)
    expect(box.height).toBe(208)
  })
})

describe('screenAwareClamp', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1080 }

  it('完全在工作区内不动', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 }
    expect(screenAwareClamp(rect, area)).toEqual(rect)
  })
  it('超出右/下边缘时平移回工作区', () => {
    const rect = { x: 1800, y: 1000, width: 200, height: 200 }
    const out = screenAwareClamp(rect, area)
    expect(out.x).toBe(1920 - 200)
    expect(out.y).toBe(1080 - 200)
    expect(out.width).toBe(200)
    expect(out.height).toBe(200)
  })
  it('超出左/上边缘（负坐标）时平移回工作区', () => {
    const rect = { x: -50, y: -80, width: 200, height: 200 }
    const out = screenAwareClamp(rect, area)
    expect(out.x).toBe(0)
    expect(out.y).toBe(0)
  })
})

describe('screenAwareOffset', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1080 }

  it('窗口在屏幕内、元素在窗口内：偏移为 0', () => {
    const off = screenAwareOffset({ x: 10, y: 10, width: 220, height: 400 }, { x: 100, y: 100 }, area)
    expect(off).toEqual({ dx: 0, dy: 0 })
  })
  it('窗口贴近右边缘、元素溢出屏幕：产生向左平移', () => {
    // 窗口右上角在 1850,100，元素局部 (100, 0) → 屏幕 x = 1950，宽 220 溢出右边缘
    const off = screenAwareOffset({ x: 100, y: 0, width: 220, height: 400 }, { x: 1850, y: 100 }, area)
    expect(off.dx).toBe(1920 - (1850 + 100 + 220))
    expect(off.dy).toBe(0)
  })
})
