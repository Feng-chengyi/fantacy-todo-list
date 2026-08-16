/**
 * 帧合成器单测（node 环境，直接构造 PixelData，无 DOM 依赖）。
 * 覆盖：合成尺寸、恒等帧、镜像帧、squash/dy 变换、叠加元素（灯/星/速度线）、
 * 贴边 QA、网格检查图、清单合法性、renderPose 纯函数性。
 */
import { describe, expect, it } from 'vitest'
import { createPixels, type PixelData } from './petImage'
import { validatePetPackManifest } from '../../../shared/petPack'
import {
  buildPetManifest,
  composeSheet,
  detectEdgeContactFrames,
  makeGridCheck,
  POSE_TABLE,
  renderPose,
  type PoseTransform
} from './petFrameComposer'

type RGBA = [number, number, number, number]

/** 帧内主体不透明像素包围盒 */
interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

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

/** 构造标准测试底图：192x208 全透明 + 中心 60x80 红色块（不触 8px 边距） */
function makeBase(): PixelData {
  const px = createPixels(192, 208)
  fill(px, 66, 64, 60, 80, [255, 0, 0, 255]) // x 66..125, y 64..143
  return px
}

/**
 * 构造贴边测试底图：主体从 y=0 贯穿到 y=207（全高，触上下边距带）。
 * 说明：squashY<1 的帧（running/jumping 落地）会把顶部内容压出上边距带，
 * 仅触顶会被「压缩」救回；贯穿全高后无论 squash/dy 如何变换都必然贴边。
 */
function makeEdgeBase(): PixelData {
  const px = createPixels(192, 208)
  fill(px, 66, 0, 60, 208, [255, 0, 0, 255]) // x 66..125, y 0..207
  return px
}

/** 从 spritesheet 切出第 i 帧（192x208） */
function frameSlice(sheet: PixelData, i: number): PixelData {
  const frame = createPixels(192, 208)
  const offsetX = i * 192
  for (let y = 0; y < 208; y++) {
    const src = (y * sheet.width + offsetX) * 4
    frame.data.set(sheet.data.subarray(src, src + 192 * 4), y * 192 * 4)
  }
  return frame
}

/** 统计帧内 alpha>0 像素的包围盒（无内容返回 null） */
function opaqueBBox(px: PixelData): BBox | null {
  let minX = px.width
  let minY = px.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) {
      if (px.data[(y * px.width + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY }
}

describe('POSE_TABLE', () => {
  it('恰好 15 项，索引即帧号', () => {
    expect(POSE_TABLE).toHaveLength(15)
  })
})

describe('composeSheet', () => {
  it('输出尺寸 2880x208', () => {
    const sheet = composeSheet(makeBase())
    expect(sheet.width).toBe(2880)
    expect(sheet.height).toBe(208)
    expect(sheet.data.length).toBe(2880 * 208 * 4)
  })

  it('idle0 帧（帧0）与 base 逐像素一致（恒等变换）', () => {
    const base = makeBase()
    const frame0 = frameSlice(composeSheet(base), 0)
    expect(frame0.width).toBe(base.width)
    expect(frame0.height).toBe(base.height)
    let mismatches = 0
    for (let i = 0; i < frame0.data.length; i++) {
      if (frame0.data[i] !== base.data[i]) mismatches += 1
    }
    expect(mismatches).toBe(0)
  })

  it('mirror 帧（帧4/running-left[0]）与对应 right 帧（帧2）互为水平镜像', () => {
    const sheet = composeSheet(makeBase())
    const left = frameSlice(sheet, 4)
    const right = frameSlice(sheet, 2)
    let opaqueCount = 0
    let mismatches = 0
    for (let y = 0; y < 208; y++) {
      for (let x = 0; x < 192; x++) {
        const l = colorAt(left, x, y)
        if (l[3] === 0) continue
        opaqueCount += 1
        const r = colorAt(right, 191 - x, y) // 断言：left(x,y) === right(191-x,y)
        if (l[0] !== r[0] || l[1] !== r[1] || l[2] !== r[2] || l[3] !== r[3]) mismatches += 1
      }
    }
    expect(opaqueCount).toBeGreaterThan(0) // 确认确实比较了不透明内容
    expect(mismatches).toBe(0)
  })

  it('squash 生效：jumping 帧1（squashX 1.08）内容宽度 > idle0 内容宽度', () => {
    const sheet = composeSheet(makeBase())
    const jump1 = opaqueBBox(frameSlice(sheet, 9))
    const idle0 = opaqueBBox(frameSlice(sheet, 0))
    expect(jump1).not.toBeNull()
    expect(idle0).not.toBeNull()
    const wJump = (jump1 as BBox).maxX - (jump1 as BBox).minX + 1
    const wIdle = (idle0 as BBox).maxX - (idle0 as BBox).minX + 1
    expect(wJump).toBeGreaterThan(wIdle)
  })

  it('dy 生效：waving 帧1 内容 bbox 的 minY < waving 帧0 的 minY（上移）', () => {
    const sheet = composeSheet(makeBase())
    const wave1 = opaqueBBox(frameSlice(sheet, 7))
    const wave0 = opaqueBBox(frameSlice(sheet, 6))
    expect(wave1).not.toBeNull()
    expect(wave0).not.toBeNull()
    expect((wave1 as BBox).minY).toBeLessThan((wave0 as BBox).minY)
  })

  it('lamp on 帧（帧10）指示灯区域存在 (62,230,176) 高亮像素', () => {
    const frame10 = frameSlice(composeSheet(makeBase()), 10)
    // 指示灯区域中心 (96, 156)（区域 x 84..107, y 150..161）
    expect(colorAt(frame10, 96, 156)).toEqual([62, 230, 176, 255])
  })

  it('lamp off 帧（帧11）同区域 alpha 明显更低', () => {
    const sheet = composeSheet(makeBase())
    const on = colorAt(frameSlice(sheet, 10), 96, 156)
    const off = colorAt(frameSlice(sheet, 11), 96, 156)
    expect(off[0]).toBe(62)
    expect(off[1]).toBe(230)
    expect(off[2]).toBe(176)
    expect(off[3]).toBeLessThan(on[3] / 2) // 90 << 255
  })

  it('stars 帧（帧14）四角星点坐标存在荧光青像素', () => {
    const frame14 = frameSlice(composeSheet(makeBase()), 14)
    const spots: Array<[number, number]> = [
      [20, 24],
      [168, 20],
      [172, 60],
      [16, 64]
    ]
    for (const [x, y] of spots) {
      expect(colorAt(frame14, x, y)).toEqual([62, 230, 176, 255])
    }
  })

  it('速度线：帧2 在左侧、帧4 经镜像落在右侧', () => {
    const sheet = composeSheet(makeBase())
    const right = frameSlice(sheet, 2)
    const left = frameSlice(sheet, 4)
    // 帧2：左侧 x=18, y=80 有荧光青速度线；右侧 x=173 无
    expect(colorAt(right, 18, 80)).toEqual([62, 230, 176, 255])
    expect(colorAt(right, 173, 80)[3]).toBe(0)
    // 帧4（镜像）：右侧 x=191-18=173 有；左侧无
    expect(colorAt(left, 173, 80)).toEqual([62, 230, 176, 255])
    expect(colorAt(left, 18, 80)[3]).toBe(0)
  })
})

describe('detectEdgeContactFrames', () => {
  it('正常底图（主体不触边距）返回空数组', () => {
    expect(detectEdgeContactFrames(composeSheet(makeBase()))).toEqual([])
  })

  it('贴边底图（主体延伸到 y=0）→ 全部 15 帧违规', () => {
    const violations = detectEdgeContactFrames(composeSheet(makeEdgeBase()))
    expect(violations).toHaveLength(15)
    expect(violations).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })
})

describe('makeGridCheck', () => {
  it('x=0 与 x=192 处垂直线为红色，x=5 非红线', () => {
    const grid = makeGridCheck(composeSheet(makeBase()))
    // y=100 处（避开主体与叠加元素）检查垂直线
    const at0 = colorAt(grid, 0, 100)
    expect(at0[0]).toBe(255)
    expect(at0[3]).toBeGreaterThan(0)
    const at192 = colorAt(grid, 192, 100)
    expect(at192[0]).toBe(255)
    expect(at192[3]).toBeGreaterThan(0)
    // 非边界列 x=5：idle 帧该处为透明，r=0
    const at5 = colorAt(grid, 5, 100)
    expect(at5[0]).toBe(0)
  })

  it('不修改传入的 sheet（返回副本）', () => {
    const sheet = composeSheet(makeBase())
    const before = new Uint8ClampedArray(sheet.data)
    makeGridCheck(sheet)
    let diffs = 0
    for (let i = 0; i < sheet.data.length; i++) {
      if (sheet.data[i] !== before[i]) diffs += 1
    }
    expect(diffs).toBe(0)
  })
})

describe('buildPetManifest', () => {
  it('生成清单通过 validatePetPackManifest 校验（ok: true）', () => {
    const manifest = buildPetManifest('mymascot', '我的吉祥物')
    const result = validatePetPackManifest(manifest)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest.id).toBe('mymascot')
      expect(result.manifest.name).toBe('我的吉祥物')
    }
  })

  it('loop 语义：jumping 与 finishing 不循环，其余循环', () => {
    const m = buildPetManifest('p', 'p')
    expect(m.animations.jumping.loop).toBe(false)
    expect(m.animations.finishing.loop).toBe(false)
    expect(m.animations.idle.loop).toBe(true)
    expect(m.animations['running-left'].loop).toBe(true)
  })
})

describe('renderPose', () => {
  const IDENTITY: PoseTransform = { dx: 0, dy: 0, squashX: 1, squashY: 1, mirror: false }

  it('mirror 恒等性：仅镜像时结果等于 base 的水平翻转', () => {
    const base = makeBase()
    const mirrored = renderPose(base, { ...IDENTITY, mirror: true })
    let mismatches = 0
    for (let y = 0; y < 208; y++) {
      for (let x = 0; x < 192; x++) {
        const m = colorAt(mirrored, x, y)
        const b = colorAt(base, 191 - x, y)
        if (m[0] !== b[0] || m[1] !== b[1] || m[2] !== b[2] || m[3] !== b[3]) mismatches += 1
      }
    }
    expect(mismatches).toBe(0)
  })

  it('squash 变换不修改入参 base（纯函数）', () => {
    const base = makeBase()
    const before = new Uint8ClampedArray(base.data)
    renderPose(base, { dx: 1, dy: -2, squashX: 1.08, squashY: 0.9, mirror: false })
    renderPose(base, { dx: 0, dy: 0, squashX: 0.94, squashY: 1.05, mirror: true, stars: true, lamp: 'on', speedLines: -1 })
    let diffs = 0
    for (let i = 0; i < base.data.length; i++) {
      if (base.data[i] !== before[i]) diffs += 1
    }
    expect(diffs).toBe(0)
    expect(base.width).toBe(192)
    expect(base.height).toBe(208)
  })
})
