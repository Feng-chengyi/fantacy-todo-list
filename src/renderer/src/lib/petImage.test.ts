/**
 * 桌宠图片预处理纯函数单测（node 环境，直接构造 PixelData，无 DOM 依赖）。
 */
import { describe, expect, it } from 'vitest'
import {
  createPixels,
  extractSubject,
  hasEdgeContact,
  letterboxTo,
  outline,
  pixelate,
  removeBackground,
  sampleEdgeBackgroundColor,
  trimAlphaEdges,
  type PixelData
} from './petImage'

type RGBA = [number, number, number, number]

/** 向 px 的矩形区域 (x,y) 起 w×h 填充颜色 */
function fill(px: PixelData, x: number, y: number, w: number, h: number, c: RGBA): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * px.width + xx) * 4
      px.data[i] = c[0]
      px.data[i + 1] = c[1]
      px.data[i + 2] = c[2]
      px.data[i + 3] = c[3]
    }
  }
}

/** 读取 (x,y) 处的 RGBA */
function colorAt(px: PixelData, x: number, y: number): RGBA {
  const i = (y * px.width + x) * 4
  return [px.data[i], px.data[i + 1], px.data[i + 2], px.data[i + 3]]
}

describe('createPixels', () => {
  it('创建指定尺寸的全透明画布', () => {
    const px = createPixels(4, 3)
    expect(px.width).toBe(4)
    expect(px.height).toBe(3)
    expect(px.data.length).toBe(4 * 3 * 4)
    for (let i = 3; i < px.data.length; i += 4) {
      expect(px.data[i]).toBe(0)
    }
  })
})

describe('sampleEdgeBackgroundColor', () => {
  it('全透明图返回 null', () => {
    expect(sampleEdgeBackgroundColor(createPixels(8, 8))).toBeNull()
  })

  it('纯色边缘返回该颜色的量化众数（平均值）', () => {
    const px = createPixels(16, 16)
    fill(px, 0, 0, 16, 16, [0, 0, 255, 255])
    fill(px, 4, 4, 8, 8, [255, 0, 0, 255])
    expect(sampleEdgeBackgroundColor(px)).toEqual({ r: 0, g: 0, b: 255 })
  })
})

describe('removeBackground', () => {
  it('纯色背景去除：蓝色背景透明、中心红主体保留、不改入参', () => {
    const px = createPixels(16, 16)
    fill(px, 0, 0, 16, 16, [0, 0, 255, 255]) // 整图蓝背景
    fill(px, 4, 4, 8, 8, [255, 0, 0, 255]) // 中心 8x8 红主体

    const out = removeBackground(px, { tolerance: 48 })

    // 主体红保留
    expect(colorAt(out, 8, 8)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 4, 4)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 11, 11)).toEqual([255, 0, 0, 255])
    // 背景蓝透明（边缘 + 主体外围）
    expect(colorAt(out, 0, 0)[3]).toBe(0)
    expect(colorAt(out, 15, 15)[3]).toBe(0)
    expect(colorAt(out, 3, 8)[3]).toBe(0)
    expect(colorAt(out, 8, 3)[3]).toBe(0)
    // 纯函数：入参不被修改
    expect(colorAt(px, 0, 0)).toEqual([0, 0, 255, 255])
  })

  it('白主体保护：主体色在容差内但未与边缘连通 → 保留', () => {
    const px = createPixels(16, 16)
    fill(px, 0, 0, 16, 16, [255, 255, 255, 255]) // 白背景
    fill(px, 5, 5, 6, 6, [0, 0, 0, 255]) // 深色隔离环（距白 ≈441 > 30，阻断扩散）
    fill(px, 6, 6, 4, 4, [235, 255, 255, 255]) // 主体距白 20 ≤ 30（若按全局阈值会被误删）

    const out = removeBackground(px, { tolerance: 30 })

    // 白背景被移除
    expect(colorAt(out, 0, 0)[3]).toBe(0)
    expect(colorAt(out, 2, 2)[3]).toBe(0)
    // 隔离环保留
    expect(colorAt(out, 5, 7)).toEqual([0, 0, 0, 255])
    expect(colorAt(out, 10, 7)).toEqual([0, 0, 0, 255])
    // 主体未与边缘连通 → 即使颜色命中容差也保留
    expect(colorAt(out, 7, 7)).toEqual([235, 255, 255, 255])
    expect(colorAt(out, 6, 6)).toEqual([235, 255, 255, 255])
    expect(colorAt(out, 9, 9)).toEqual([235, 255, 255, 255])
  })

  it('全透明图（采样为 null）原样返回副本', () => {
    const px = createPixels(8, 8)
    const out = removeBackground(px, { tolerance: 32 })
    expect(out.width).toBe(8)
    expect(out.height).toBe(8)
    expect(out.data.length).toBe(8 * 8 * 4)
    for (let i = 3; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(0)
    }
  })
})

describe('extractSubject', () => {
  it('返回最大连通域的 bounding box 裁剪结果', () => {
    const px = createPixels(16, 16)
    fill(px, 2, 2, 6, 6, [255, 0, 0, 255]) // 大主体 6x6
    fill(px, 12, 12, 2, 2, [0, 0, 255, 255]) // 小主体 2x2（分离）

    const { pixels, box } = extractSubject(px)

    expect(box).toEqual({ x: 2, y: 2, w: 6, h: 6 })
    expect(pixels.width).toBe(6)
    expect(pixels.height).toBe(6)
    expect(colorAt(pixels, 0, 0)).toEqual([255, 0, 0, 255])
    expect(colorAt(pixels, 5, 5)).toEqual([255, 0, 0, 255])
    expect(colorAt(pixels, 3, 0)).toEqual([255, 0, 0, 255])
  })

  it('无主体返回全尺寸副本与零尺寸 box', () => {
    const px = createPixels(5, 7)
    const { pixels, box } = extractSubject(px)
    expect(box).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(pixels.width).toBe(5)
    expect(pixels.height).toBe(7)
    expect(pixels.data.length).toBe(5 * 7 * 4)
  })
})

describe('letterboxTo', () => {
  it('10x10 主体放入 20x20 画布 margin=4：居中且四周 ≥4px 透明', () => {
    const px = createPixels(10, 10)
    fill(px, 0, 0, 10, 10, [255, 0, 0, 255])

    const out = letterboxTo(px, 20, 20, 4)

    expect(out.width).toBe(20)
    expect(out.height).toBe(20)
    // 等比 1.2 倍 → 内容 12x12，位于 [4,16)
    expect(colorAt(out, 4, 4)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 15, 15)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 3, 4)[3]).toBe(0) // 左侧留白 ≥4
    expect(colorAt(out, 16, 4)[3]).toBe(0) // 右侧留白 ≥4
    expect(colorAt(out, 10, 3)[3]).toBe(0) // 上侧留白 ≥4
    expect(colorAt(out, 10, 16)[3]).toBe(0) // 下侧留白 ≥4

    // 统计不透明内容的外接范围：尺寸 ≤12x12 且四边 ≥4px 透明
    let minX = 20
    let minY = 20
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        if (colorAt(out, x, y)[3] === 0) continue
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
    expect(maxX - minX + 1).toBeLessThanOrEqual(12)
    expect(maxY - minY + 1).toBeLessThanOrEqual(12)
    expect(minX).toBeGreaterThanOrEqual(4)
    expect(minY).toBeGreaterThanOrEqual(4)
    expect(maxX).toBeLessThanOrEqual(15)
    expect(maxY).toBeLessThanOrEqual(15)
  })
})

describe('pixelate', () => {
  it('40x40 grid=10：输出 40x40 且每 4x4 块颜色一致（取块中心色）', () => {
    const px = createPixels(40, 40)
    fill(px, 0, 0, 40, 40, [0, 0, 255, 255]) // 全蓝
    fill(px, 0, 0, 20, 40, [255, 0, 0, 255]) // 左半红
    fill(px, 12, 12, 1, 1, [0, 255, 0, 255]) // 红区内一个绿噪点（非块中心）

    const out = pixelate(px, 10, 10)

    expect(out.width).toBe(40)
    expect(out.height).toBe(40)
    // 块 (3,3)（x12-15,y12-15）中心 (13,13) 为红 → 整块红，绿噪点被中心色覆盖
    expect(colorAt(out, 12, 12)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 13, 13)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 15, 12)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 12, 15)).toEqual([255, 0, 0, 255])
    // 块 (0,0) 全红一致
    expect(colorAt(out, 0, 0)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 3, 3)).toEqual([255, 0, 0, 255])
    // 右半蓝块一致
    expect(colorAt(out, 20, 20)).toEqual([0, 0, 255, 255])
    expect(colorAt(out, 23, 23)).toEqual([0, 0, 255, 255])
    expect(colorAt(out, 39, 39)).toEqual([0, 0, 255, 255])
  })

  it('maxColors 均匀量化：k=ceil(256/4)=64，各通道 round(v/64)*64', () => {
    const px = createPixels(8, 8)
    fill(px, 0, 0, 4, 4, [100, 50, 200, 255])

    const plain = pixelate(px, 2, 2)
    expect(colorAt(plain, 0, 0)).toEqual([100, 50, 200, 255])
    expect(colorAt(plain, 3, 3)).toEqual([100, 50, 200, 255])

    const quantized = pixelate(px, 2, 2, 4)
    // 100→128、50→64、200→192
    expect(colorAt(quantized, 0, 0)).toEqual([128, 64, 192, 255])
    expect(colorAt(quantized, 3, 3)).toEqual([128, 64, 192, 255])
  })
})

describe('outline', () => {
  it('中心 4x4 红块 gridScale=2 → 外扩一圈宽 2 的默认深色描边', () => {
    const px = createPixels(8, 8)
    fill(px, 2, 2, 4, 4, [255, 0, 0, 255])

    const out = outline(px, 2)

    // 主体保留
    expect(colorAt(out, 2, 2)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 3, 3)).toEqual([255, 0, 0, 255])
    expect(colorAt(out, 5, 5)).toEqual([255, 0, 0, 255])
    // 四周一圈（宽 2px）默认深色 {30,30,46}
    expect(colorAt(out, 1, 3)).toEqual([30, 30, 46, 255]) // 左
    expect(colorAt(out, 0, 2)).toEqual([30, 30, 46, 255])
    expect(colorAt(out, 6, 3)).toEqual([30, 30, 46, 255]) // 右
    expect(colorAt(out, 2, 0)).toEqual([30, 30, 46, 255]) // 上
    expect(colorAt(out, 3, 6)).toEqual([30, 30, 46, 255]) // 下
    // 对角角落格不与主体 4 邻接 → 保持透明
    expect(colorAt(out, 0, 0)[3]).toBe(0)
    expect(colorAt(out, 7, 7)[3]).toBe(0)
    expect(colorAt(out, 7, 0)[3]).toBe(0)
  })

  it('支持自定义描边色', () => {
    const px = createPixels(8, 8)
    fill(px, 2, 2, 4, 4, [255, 0, 0, 255])

    const out = outline(px, 2, { r: 9, g: 8, b: 7 })
    expect(colorAt(out, 1, 3)).toEqual([9, 8, 7, 255])
    expect(colorAt(out, 3, 3)).toEqual([255, 0, 0, 255])
  })
})

describe('trimAlphaEdges', () => {
  it('alpha=5 噪点被清、alpha=200 保留、alpha=8（等于阈值）保留', () => {
    const px = createPixels(4, 4)
    fill(px, 0, 0, 1, 1, [10, 20, 30, 5]) // 残影噪点
    fill(px, 1, 1, 1, 1, [40, 50, 60, 200]) // 正常主体
    fill(px, 2, 2, 1, 1, [70, 80, 90, 8]) // 等于默认阈值 8，不清理

    const out = trimAlphaEdges(px)
    expect(colorAt(out, 0, 0)[3]).toBe(0)
    expect(colorAt(out, 1, 1)).toEqual([40, 50, 60, 200])
    expect(colorAt(out, 2, 2)).toEqual([70, 80, 90, 8])
  })

  it('支持自定义阈值', () => {
    const px = createPixels(4, 4)
    fill(px, 0, 0, 1, 1, [10, 20, 30, 50])
    fill(px, 1, 1, 1, 1, [40, 50, 60, 200])

    const out = trimAlphaEdges(px, 100)
    expect(colorAt(out, 0, 0)[3]).toBe(0)
    expect(colorAt(out, 1, 1)).toEqual([40, 50, 60, 200])
  })
})

describe('hasEdgeContact', () => {
  it('主体贴边 → true', () => {
    const px = createPixels(16, 16)
    fill(px, 0, 5, 4, 4, [255, 0, 0, 255]) // 触碰左边缘
    expect(hasEdgeContact(px, 2)).toBe(true)
  })

  it('主体与四边均留足 margin → false；margin 加大后 → true', () => {
    const px = createPixels(16, 16)
    fill(px, 4, 4, 4, 4, [255, 0, 0, 255]) // 距四边均 4px
    expect(hasEdgeContact(px, 4)).toBe(false)
    expect(hasEdgeContact(px, 5)).toBe(true)
  })

  it('全透明图恒为 false', () => {
    expect(hasEdgeContact(createPixels(10, 10), 3)).toBe(false)
  })
})
