/**
 * 自定义宠物「帧合成器」：把用户图片处理得到的基础精灵（192x208 PixelData）
 * 按姿势表合成为 15 帧横排 spritesheet（Codex v2 精简契约）。
 *
 * 帧布局（与内置角色一致）：
 *   idle [0,1] | running-right [2,3] | running-left [4,5] | waving [6,7]
 *   jumping [8,9] | timing [10,11] | finishing [12,13,14]
 *
 * 约定：
 * - 全部为纯函数：无 DOM / Canvas / IO 依赖，可在 node 测试环境运行；
 * - 所有函数返回新对象，绝不修改传入参数；
 * - 变换锚点为精灵「底部中心」：squash 围绕底部中心缩放，dx/dy 为像素平移；
 * - 照片基底只能整体变换（无法像内置角色那样摆动四肢），
 *   姿势语义参考内置 gen-pets.mjs，用 squash / 平移 / 镜像 / 叠加元素近似。
 */

import type { PetPackManifest } from '../../../shared/types'
import {
  PET_FRAME_COUNT,
  PET_FRAME_H,
  PET_FRAME_W,
  PET_SHEET_H,
  PET_SHEET_W
} from '../../../shared/petPack'
import { createPixels, type PixelData } from './petImage'

/** 姿势变换参数（第 i 项作用于帧 i） */
export interface PoseTransform {
  /** 水平像素位移（正 = 右移） */
  dx: number
  /** 垂直像素位移（负 = 上移，腾空用） */
  dy: number
  /** 水平缩放（1 为基准，围绕精灵底部中心） */
  squashX: number
  /** 垂直缩放（1 为基准，围绕精灵底部中心；>1 拉长 / <1 压扁） */
  squashY: number
  /** 整帧水平镜像（running-left 复用 right 帧序，渲染时镜像，绝不交换帧序） */
  mirror: boolean
  /** 胸前指示灯：timing 动画 on/off 交替（缺省不叠加） */
  lamp?: 'on' | 'off'
  /** 四角星点闪光（waving 招呼 / finishing 落地庆祝） */
  stars?: boolean
  /** 速度线：-1 画在左侧（表动向右）、1 画在右侧（表动向左）、0/缺省不画 */
  speedLines?: -1 | 0 | 1
}

/**
 * 15 项姿势表（索引即帧号）。
 * 设计说明：
 * - idle：恒等 + 微弹（squashY 0.97 / squashX 1.02 的呼吸感）；
 * - running-right：squash 压缩蓄力 + 左侧速度线（表动向右），两帧 dx 微移制造律动；
 * - running-left：与 right 完全同参但 mirror: true —— 渲染时整帧水平镜像，
 *   速度线随之翻到右侧（表动向左），帧序保持不变；
 * - waving：dy 上移交替（0 / -6）表挥手起伏；实现上「dy 差异 + 第二帧星点」并用，
 *   星点为可选装饰（规范允许二选一，此处叠加增强招呼感）；
 * - jumping：帧0 腾空拉长（squashX 0.94 / squashY 1.05、dy -10），
 *   帧1 落地压扁（squashX 1.08 / squashY 0.9）；
 * - timing：胸前指示灯 on/off 交替（alpha 255 / 90）；
 * - finishing：举手（dy -4）→ 跳跃（dy -12）→ 落地 + 四角星点庆祝。
 */
export const POSE_TABLE: PoseTransform[] = [
  // idle
  { dx: 0, dy: 0, squashX: 1, squashY: 1, mirror: false },
  { dx: 0, dy: 0, squashX: 1.02, squashY: 0.97, mirror: false },
  // running-right（速度线在左侧 = 向右跑）
  { dx: 0, dy: 0, squashX: 1.04, squashY: 0.96, mirror: false, speedLines: -1 },
  { dx: 3, dy: 0, squashX: 1.04, squashY: 0.96, mirror: false, speedLines: -1 },
  // running-left（与 right 同参 + 镜像；线经镜像落在右侧 = 向左跑）
  { dx: 0, dy: 0, squashX: 1.04, squashY: 0.96, mirror: true, speedLines: -1 },
  { dx: 3, dy: 0, squashX: 1.04, squashY: 0.96, mirror: true, speedLines: -1 },
  // waving
  { dx: 0, dy: 0, squashX: 1, squashY: 1, mirror: false },
  { dx: 0, dy: -6, squashX: 1, squashY: 1, mirror: false, stars: true },
  // jumping
  { dx: 0, dy: -10, squashX: 0.94, squashY: 1.05, mirror: false },
  { dx: 0, dy: 0, squashX: 1.08, squashY: 0.9, mirror: false },
  // timing（指示灯 on / off）
  { dx: 0, dy: 0, squashX: 1, squashY: 1, mirror: false, lamp: 'on' },
  { dx: 0, dy: 0, squashX: 1, squashY: 1, mirror: false, lamp: 'off' },
  // finishing
  { dx: 0, dy: -4, squashX: 1, squashY: 1, mirror: false },
  { dx: 0, dy: -12, squashX: 1, squashY: 1, mirror: false },
  { dx: 0, dy: 0, squashX: 1, squashY: 1, mirror: false, stars: true }
]

/** 荧光青叠加色（#3ee6b0：指示灯 / 星点 / 速度线共用） */
const ACCENT = { r: 62, g: 230, b: 176 } as const

/** 指示灯区域（帧内固定坐标，胸前位置） */
const LAMP = { x: 84, y: 150, w: 24, h: 12 } as const
/** 四角星点坐标（2x2 方块左上角，避开中心主体） */
const STAR_SPOTS = [
  { x: 20, y: 24 },
  { x: 168, y: 20 },
  { x: 172, y: 60 },
  { x: 16, y: 64 }
] as const
/** 速度线（1px 高横线）：-1 左侧 / 1 右侧（对称） */
const SPEED_LINE = { x0: 10, x1: 27, ys: [80, 100] } as const

/** 在 px 的 (x,y) 处写一个 RGBA 像素（越界忽略） */
function setPixel(
  px: PixelData,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number
): void {
  if (x < 0 || y < 0 || x >= px.width || y >= px.height) return
  const i = (y * px.width + x) * 4
  px.data[i] = r
  px.data[i + 1] = g
  px.data[i + 2] = b
  px.data[i + 3] = a
}

/** 整帧水平镜像（逐像素左右翻转，返回新画布） */
function flipHorizontal(px: PixelData): PixelData {
  const out = createPixels(px.width, px.height)
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) {
      const src = (y * px.width + x) * 4
      const dst = (y * px.width + (px.width - 1 - x)) * 4
      out.data[dst] = px.data[src]
      out.data[dst + 1] = px.data[src + 1]
      out.data[dst + 2] = px.data[src + 2]
      out.data[dst + 3] = px.data[src + 3]
    }
  }
  return out
}

/**
 * 渲染单帧：把 base 按姿势变换绘制到 192x208 透明帧画布。
 *
 * 步骤：
 * 1. 最近邻采样：目标像素 (x,y) 反向映射回源（去掉 dx/dy 平移后，
 *    围绕底部中心 (base.width/2, base.height) 反缩放）；源 alpha 0 跳过；
 * 2. 叠加速度线（先画，参与镜像 → running-left 的线自然落在右侧）；
 * 3. mirror 时整帧水平镜像（含速度线，保证与对应 right 帧严格互为镜像）；
 * 4. 叠加指示灯与星点（帧内固定坐标，不参与镜像）。
 */
export function renderPose(base: PixelData, pose: PoseTransform): PixelData {
  const frame = createPixels(PET_FRAME_W, PET_FRAME_H)
  const anchorX = base.width / 2 // 精灵底部中心
  const anchorY = base.height

  // 1. squash + 平移（最近邻反向映射）
  for (let y = 0; y < PET_FRAME_H; y++) {
    const sy = Math.floor(anchorY + (y - pose.dy - anchorY) / pose.squashY)
    if (sy < 0 || sy >= base.height) continue
    for (let x = 0; x < PET_FRAME_W; x++) {
      const sx = Math.floor(anchorX + (x - pose.dx - anchorX) / pose.squashX)
      if (sx < 0 || sx >= base.width) continue
      const src = (sy * base.width + sx) * 4
      if (base.data[src + 3] === 0) continue // 源透明跳过
      const dst = (y * PET_FRAME_W + x) * 4
      frame.data[dst] = base.data[src]
      frame.data[dst + 1] = base.data[src + 1]
      frame.data[dst + 2] = base.data[src + 2]
      frame.data[dst + 3] = base.data[src + 3]
    }
  }

  // 2. 速度线（画在镜像之前：-1 左侧，1 右侧对称）
  const lines = pose.speedLines ?? 0
  if (lines !== 0) {
    const x0 = lines === -1 ? SPEED_LINE.x0 : PET_FRAME_W - SPEED_LINE.x1
    for (const y of SPEED_LINE.ys) {
      for (let x = x0; x < x0 + (SPEED_LINE.x1 - SPEED_LINE.x0); x++) {
        setPixel(frame, x, y, ACCENT.r, ACCENT.g, ACCENT.b, 255)
      }
    }
  }

  // 3. 整帧水平镜像（含速度线；先取引用便于后续叠加）
  const mirrored = pose.mirror ? flipHorizontal(frame) : frame

  // 4. 指示灯（on: alpha 255 / off: alpha 90）与四角星点
  if (pose.lamp !== undefined) {
    const a = pose.lamp === 'on' ? 255 : 90
    for (let y = LAMP.y; y < LAMP.y + LAMP.h; y++) {
      for (let x = LAMP.x; x < LAMP.x + LAMP.w; x++) {
        setPixel(mirrored, x, y, ACCENT.r, ACCENT.g, ACCENT.b, a)
      }
    }
  }
  if (pose.stars === true) {
    for (const spot of STAR_SPOTS) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          setPixel(mirrored, spot.x + dx, spot.y + dy, ACCENT.r, ACCENT.g, ACCENT.b, 255)
        }
      }
    }
  }
  return mirrored
}

/** 按 POSE_TABLE 渲染 15 帧并横向拼接为 2880x208 spritesheet */
export function composeSheet(base: PixelData): PixelData {
  const sheet = createPixels(PET_SHEET_W, PET_SHEET_H)
  for (let i = 0; i < PET_FRAME_COUNT; i++) {
    const frame = renderPose(base, POSE_TABLE[i])
    if (frame.width !== PET_FRAME_W || frame.height !== PET_FRAME_H) continue
    const offsetX = i * PET_FRAME_W
    for (let y = 0; y < PET_FRAME_H; y++) {
      const srcStart = (y * frame.width) * 4
      const dstStart = (y * PET_SHEET_W + offsetX) * 4
      sheet.data.set(frame.data.subarray(srcStart, srcStart + PET_FRAME_W * 4), dstStart)
    }
  }
  return sheet
}

/**
 * 逐帧贴边 QA：检查每帧四边 8px 边距带内是否存在 alpha>0 像素
 * （逻辑同 petImage.hasEdgeContact，但按帧切片），返回违规帧索引数组。
 */
export function detectEdgeContactFrames(sheet: PixelData): number[] {
  const violations: number[] = []
  const margin = 8
  for (let i = 0; i < PET_FRAME_COUNT; i++) {
    const x0 = i * PET_FRAME_W
    const x1 = x0 + PET_FRAME_W
    let hit = false
    for (let y = 0; y < sheet.height && !hit; y++) {
      const inTopBand = y < margin
      const inBottomBand = y >= sheet.height - margin
      for (let x = x0; x < x1; x++) {
        const inLeftBand = x - x0 < margin
        const inRightBand = x0 + PET_FRAME_W - 1 - x < margin
        if ((inTopBand || inBottomBand || inLeftBand || inRightBand) &&
            sheet.data[(y * sheet.width + x) * 4 + 3] > 0) {
          hit = true
          break
        }
      }
    }
    if (hit) violations.push(i)
  }
  return violations
}

/**
 * 网格检查图：返回 sheet 副本，在每帧左右边界（每 192px 的垂直线）
 * 与整图上下边界画 1px 红色 (255,0,0,180) 网格线，供人工核对帧切分。
 */
export function makeGridCheck(sheet: PixelData): PixelData {
  const out = createPixels(sheet.width, sheet.height)
  out.data.set(sheet.data)
  // 垂直线：每帧左边界 x = i*192（i = 0..14；x = 2880 越界不画，
  // 最后一帧右边界即图像右缘，由水平上下边线封闭）
  for (let i = 0; i < PET_FRAME_COUNT; i++) {
    const x = i * PET_FRAME_W
    if (x >= sheet.width) continue
    for (let y = 0; y < sheet.height; y++) {
      setPixel(out, x, y, 255, 0, 0, 180)
    }
  }
  // 水平线：整图上下边界（y=0 与 y=height-1）
  for (let x = 0; x < sheet.width; x++) {
    setPixel(out, x, 0, 255, 0, 0, 180)
    setPixel(out, x, sheet.height - 1, 255, 0, 0, 180)
  }
  return out
}

/**
 * 用契约布局生成合法 pet.json 清单（Codex 自定义宠物 v2）。
 * fps：idle 2 / running 8 / waving 4 / jumping 5 / timing 2 / finishing 5；
 * loop：除 jumping、finishing 外均为 true。
 */
export function buildPetManifest(id: string, name: string): PetPackManifest {
  return {
    formatVersion: 2,
    spec: 'codex-custom-pet-v2',
    id,
    name,
    frame: { width: PET_FRAME_W, height: PET_FRAME_H },
    spritesheet: { file: 'spritesheet.png', layout: 'horizontal', frameCount: PET_FRAME_COUNT },
    animations: {
      idle: { frames: [0, 1], fps: 2, loop: true },
      'running-right': { frames: [2, 3], fps: 8, loop: true },
      'running-left': { frames: [4, 5], fps: 8, loop: true },
      waving: { frames: [6, 7], fps: 4, loop: true },
      jumping: { frames: [8, 9], fps: 5, loop: false },
      timing: { frames: [10, 11], fps: 2, loop: true },
      finishing: { frames: [12, 13, 14], fps: 5, loop: false }
    }
  }
}
