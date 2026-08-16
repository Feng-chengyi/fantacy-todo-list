/**
 * 桌宠图片预处理纯函数库（用户导入图片 → 桌宠基础精灵）。
 *
 * 典型流水线：
 *   sampleEdgeBackgroundColor → removeBackground（边缘种子键控）
 *   → extractSubject（最大连通域裁剪）→ letterboxTo（等比信箱缩放）
 *   → pixelate（网格化降采样 + 颜色量化）→ outline（硬边描边）
 *   → trimAlphaEdges（清理键控残影）；hasEdgeContact 用于贴边 QA。
 *
 * 约定：
 * - 全部为纯函数：无 DOM / Canvas / IO 依赖，可在 node 测试环境运行；
 * - 所有函数返回新对象，绝不修改传入参数；
 * - 像素为 RGBA 顺序（每像素 4 字节），坐标原点在左上角。
 */

/** 像素数据（RGBA，node 测试环境可用，等价 ImageData） */
export interface PixelData {
  width: number
  height: number
  /** RGBA 顺序，长度 = width*height*4 */
  data: Uint8ClampedArray
}

/** RGB 颜色（0-255） */
export interface RGB {
  r: number
  g: number
  b: number
}

/** 主体包围盒（像素坐标，含 x/y/w/h） */
export interface BoundingBox {
  x: number
  y: number
  w: number
  h: number
}

/** 创建全透明像素画布 */
export function createPixels(width: number, height: number): PixelData {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0) {
    throw new Error(`createPixels: 非法尺寸 ${width}x${height}`)
  }
  return { width, height, data: new Uint8ClampedArray(width * height * 4) }
}

/** 深拷贝像素数据 */
function clonePixels(px: PixelData): PixelData {
  return { width: px.width, height: px.height, data: new Uint8ClampedArray(px.data) }
}

/**
 * 采样四边边缘出现最多的量化颜色作为背景色估计。
 * - 每边等间隔取 ~32 个点，颜色按步长 16 量化分桶统计；
 * - 忽略全透明采样点；全透明（或无有效采样）返回 null；
 * - 返回众数桶内实际颜色的平均值。
 */
export function sampleEdgeBackgroundColor(px: PixelData): RGB | null {
  const { width: w, height: h, data } = px
  if (w <= 0 || h <= 0) return null

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()
  const addSample = (x: number, y: number): void => {
    const i = (y * w + x) * 4
    if (data[i + 3] === 0) return // 跳过全透明像素
    // 量化步长 16：每通道右移 4 位作为桶键
    const key = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += 1
    bucket.r += data[i]
    bucket.g += data[i + 1]
    bucket.b += data[i + 2]
    buckets.set(key, bucket)
  }

  const samplesPerEdge = 32
  // 上、下边：沿 x 等间隔采样
  for (let i = 0; i < samplesPerEdge; i++) {
    const x = Math.min(w - 1, Math.round((i * (w - 1)) / (samplesPerEdge - 1)))
    addSample(x, 0)
    addSample(x, h - 1)
  }
  // 左、右边：沿 y 等间隔采样
  for (let i = 0; i < samplesPerEdge; i++) {
    const y = Math.min(h - 1, Math.round((i * (h - 1)) / (samplesPerEdge - 1)))
    addSample(0, y)
    addSample(w - 1, y)
  }

  let best: { count: number; r: number; g: number; b: number } | null = null
  for (const bucket of buckets.values()) {
    if (best === null || bucket.count > best.count) best = bucket
  }
  if (best === null || best.count === 0) return null
  return {
    r: Math.round(best.r / best.count),
    g: Math.round(best.g / best.count),
    b: Math.round(best.b / best.count)
  }
}

/** removeBackground 参数 */
export interface RemoveBackgroundOptions {
  /** 键控色；缺省（null/undefined）时用 sampleEdgeBackgroundColor 的采样结果 */
  key?: RGB | null
  /** 0-255 的 RGB 欧氏距离阈值 */
  tolerance: number
}

/**
 * 去除背景：以四边缘像素为种子做 BFS flood-fill，
 * 与 key 色距离 ≤ tolerance 且（从边缘）连通的像素 alpha 置 0。
 * - key 缺省用 sampleEdgeBackgroundColor；采样结果为 null（全透明图）则原样返回副本；
 * - 仅在 alpha>0 的像素间扩散（透明像素视为已被移除，不再穿越）；
 * - 语义上只删「与边缘连通的背景」，内部孤立主体即使颜色接近背景也会保留。
 */
export function removeBackground(px: PixelData, opts: RemoveBackgroundOptions): PixelData {
  const out = clonePixels(px)
  const key = opts.key ?? sampleEdgeBackgroundColor(px)
  if (key === null) return out // 无可用背景色：原样返回副本

  const { width: w, height: h, data } = px
  if (w <= 0 || h <= 0) return out

  const tol2 = Math.max(0, opts.tolerance) ** 2 // 平方距离比较，避免开方
  const removed = new Uint8Array(w * h)
  const queue: number[] = []

  const withinTolerance = (idx: number): boolean => {
    const i = idx * 4
    const dr = data[i] - key.r
    const dg = data[i + 1] - key.g
    const db = data[i + 2] - key.b
    return dr * dr + dg * dg + db * db <= tol2
  }

  // 命中（不透明 + 颜色在容差内）则标记移除并入队
  const markIfHit = (idx: number): void => {
    if (removed[idx]) return
    if (data[idx * 4 + 3] === 0) return
    if (!withinTolerance(idx)) return
    removed[idx] = 1
    queue.push(idx)
  }

  // 四边缘像素作为种子
  for (let x = 0; x < w; x++) {
    markIfHit(x) // 顶边 y=0
    markIfHit((h - 1) * w + x) // 底边
  }
  for (let y = 1; y < h - 1; y++) {
    markIfHit(y * w) // 左边
    markIfHit(y * w + w - 1) // 右边
  }

  // BFS 向四邻接扩散（head 指针代替 shift，保证广度优先且 O(n)）
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head]
    const x = idx % w
    const y = (idx - x) / w
    if (x > 0) markIfHit(idx - 1)
    if (x < w - 1) markIfHit(idx + 1)
    if (y > 0) markIfHit(idx - w)
    if (y < h - 1) markIfHit(idx + w)
  }

  // 统一写回副本：被标记像素 alpha 置 0（RGB 保留，便于后续残影清理）
  for (let idx = 0; idx < w * h; idx++) {
    if (removed[idx]) out.data[idx * 4 + 3] = 0
  }
  return out
}

/**
 * 提取主体：找 alpha>0 的最大 4 连通域（BFS），
 * 返回其 bounding box 裁剪出的新 PixelData 与包围盒。
 * 无主体时返回全尺寸原样副本与零尺寸 box（x=y=w=h=0）。
 */
export function extractSubject(px: PixelData): { pixels: PixelData; box: BoundingBox } {
  const { width: w, height: h, data } = px
  const total = w * h
  const visited = new Uint8Array(total)
  let bestSize = 0
  let bestBox: BoundingBox | null = null

  for (let start = 0; start < total; start++) {
    if (visited[start] || data[start * 4 + 3] === 0) continue

    // BFS 遍历一个连通域，同时统计尺寸与包围盒
    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    let size = 0
    const queue: number[] = [start]
    visited[start] = 1
    for (let head = 0; head < queue.length; head++) {
      const idx = queue[head]
      const x = idx % w
      const y = (idx - x) / w
      size += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      // 四邻接入队
      const tryVisit = (next: number): void => {
        if (!visited[next] && data[next * 4 + 3] > 0) {
          visited[next] = 1
          queue.push(next)
        }
      }
      if (x > 0) tryVisit(idx - 1)
      if (x < w - 1) tryVisit(idx + 1)
      if (y > 0) tryVisit(idx - w)
      if (y < h - 1) tryVisit(idx + w)
    }

    if (size > bestSize) {
      bestSize = size
      bestBox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    }
  }

  if (bestBox === null) {
    // 无主体：全尺寸原样副本 + 零尺寸 box
    return { pixels: clonePixels(px), box: { x: 0, y: 0, w: 0, h: 0 } }
  }

  // 按 bbox 逐行裁剪（bbox 内其它连通域的像素按原样保留）
  const crop = createPixels(bestBox.w, bestBox.h)
  for (let row = 0; row < bestBox.h; row++) {
    const srcStart = ((bestBox.y + row) * w + bestBox.x) * 4
    crop.data.set(px.data.subarray(srcStart, srcStart + bestBox.w * 4), row * bestBox.w * 4)
  }
  return { pixels: crop, box: bestBox }
}

/**
 * 信箱缩放：等比缩放（最近邻采样）使内容适配
 * (targetW-2*margin) × (targetH-2*margin) 区域，居中放入透明 targetW×targetH 画布。
 * margin ≥ 0；缩放结果至少 1×1 像素。
 */
export function letterboxTo(
  px: PixelData,
  targetW: number,
  targetH: number,
  margin: number
): PixelData {
  const canvas = createPixels(targetW, targetH)
  const availW = Math.max(0, targetW - 2 * margin)
  const availH = Math.max(0, targetH - 2 * margin)
  if (px.width <= 0 || px.height <= 0 || availW <= 0 || availH <= 0) return canvas

  const scale = Math.min(availW / px.width, availH / px.height)
  const destW = Math.max(1, Math.min(availW, Math.round(px.width * scale)))
  const destH = Math.max(1, Math.min(availH, Math.round(px.height * scale)))
  const offsetX = Math.floor((targetW - destW) / 2)
  const offsetY = Math.floor((targetH - destH) / 2)

  // 最近邻采样：目标像素中心映射回源图
  for (let dy = 0; dy < destH; dy++) {
    const sy = Math.min(px.height - 1, Math.floor(((dy + 0.5) * px.height) / destH))
    for (let dx = 0; dx < destW; dx++) {
      const sx = Math.min(px.width - 1, Math.floor(((dx + 0.5) * px.width) / destW))
      const src = (sy * px.width + sx) * 4
      const dst = ((offsetY + dy) * targetW + offsetX + dx) * 4
      canvas.data[dst] = px.data[src]
      canvas.data[dst + 1] = px.data[src + 1]
      canvas.data[dst + 2] = px.data[src + 2]
      canvas.data[dst + 3] = px.data[src + 3]
    }
  }
  return canvas
}

/**
 * 网格化降采样（像素风）：
 * - 按 gridW×gridH 网格分格，每格取中心像素颜色，alpha 取格内多数表决
 *   （alpha>128 的像素过半 → 不透明 255，否则透明 0，格内全透明自然为透明）；
 * - 每格颜色硬边放大填满整格，返回尺寸与输入相同；
 * - maxColors 提供时做简单均匀量化（近似值，非最优聚类）：
 *   k = ceil(256/maxColors)，每通道 v → round(v/k)*k 并封顶 255。
 */
export function pixelate(
  px: PixelData,
  gridW: number,
  gridH: number,
  maxColors?: number
): PixelData {
  const { width: w, height: h, data } = px
  const out = createPixels(w, h)
  if (w <= 0 || h <= 0) return out

  const gw = Math.max(1, Math.floor(gridW))
  const gh = Math.max(1, Math.floor(gridH))
  const doQuant = maxColors !== undefined && maxColors >= 1
  const quantStep = doQuant ? Math.ceil(256 / Math.max(1, Math.floor(maxColors))) : 1
  const quantize = (v: number): number =>
    doQuant ? Math.min(255, Math.round(v / quantStep) * quantStep) : v

  for (let cy = 0; cy < gh; cy++) {
    const y0 = Math.floor((cy * h) / gh)
    const y1 = Math.floor(((cy + 1) * h) / gh)
    if (y1 <= y0) continue // 网格数超过像素数时可能出现空格
    for (let cx = 0; cx < gw; cx++) {
      const x0 = Math.floor((cx * w) / gw)
      const x1 = Math.floor(((cx + 1) * w) / gw)
      if (x1 <= x0) continue

      // alpha 多数表决
      const total = (x1 - x0) * (y1 - y0)
      let opaque = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (data[(y * w + x) * 4 + 3] > 128) opaque += 1
        }
      }
      if (opaque * 2 <= total) continue // 透明格：输出保持全 0

      // 取格中心像素（向下取整的近似中心）颜色
      const centerX = Math.floor((x0 + x1 - 1) / 2)
      const centerY = Math.floor((y0 + y1 - 1) / 2)
      const center = (centerY * w + centerX) * 4
      const r = quantize(data[center])
      const g = quantize(data[center + 1])
      const b = quantize(data[center + 2])

      // 硬边放大：整格填同色
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4
          out.data[i] = r
          out.data[i + 1] = g
          out.data[i + 2] = b
          out.data[i + 3] = 255
        }
      }
    }
  }
  return out
}

/**
 * 硬边描边：概念上把图按 gridScale 像素/格分格，
 * 全透明格若 4 邻接含不透明格（格内有 alpha>0 像素），整格填 color（默认深色 {30,30,46}）。
 * 描边硬边、无抗锯齿；不透明格原样保留。
 */
export function outline(
  px: PixelData,
  gridScale: number,
  color?: RGB
): PixelData {
  const { width: w, height: h, data } = px
  const out = clonePixels(px)
  if (w <= 0 || h <= 0) return out

  const gs = Math.max(1, Math.floor(gridScale))
  const cols = Math.ceil(w / gs)
  const rows = Math.ceil(h / gs)
  const stroke = color ?? { r: 30, g: 30, b: 46 }

  // 先标记每个网格是否含有不透明像素
  const opaque = new Uint8Array(cols * rows)
  for (let y = 0; y < h; y++) {
    const cy = Math.min(rows - 1, Math.floor(y / gs))
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        const cx = Math.min(cols - 1, Math.floor(x / gs))
        opaque[cy * cols + cx] = 1
      }
    }
  }

  // 透明格若 4 邻接不透明格 → 整格填描边色
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (opaque[cy * cols + cx]) continue
      const neighborOpaque =
        (cx > 0 && opaque[cy * cols + cx - 1] === 1) ||
        (cx < cols - 1 && opaque[cy * cols + cx + 1] === 1) ||
        (cy > 0 && opaque[(cy - 1) * cols + cx] === 1) ||
        (cy < rows - 1 && opaque[(cy + 1) * cols + cx] === 1)
      if (!neighborOpaque) continue

      const x0 = cx * gs
      const y0 = cy * gs
      const x1 = Math.min(w, x0 + gs)
      const y1 = Math.min(h, y0 + gs)
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4
          out.data[i] = stroke.r
          out.data[i + 1] = stroke.g
          out.data[i + 2] = stroke.b
          out.data[i + 3] = 255
        }
      }
    }
  }
  return out
}

/**
 * 清理键控残影：alpha < threshold（默认 8）的像素 alpha 置 0。
 */
export function trimAlphaEdges(px: PixelData, threshold = 8): PixelData {
  const out = clonePixels(px)
  for (let i = 3; i < out.data.length; i += 4) {
    if (out.data[i] < threshold) out.data[i] = 0
  }
  return out
}

/**
 * 贴边 QA：检测是否存在 alpha>0 像素进入四边 margin 范围内
 * （即 x<margin || y<margin || x>=width-margin || y>=height-margin 的条带）。
 * margin=0 表示条带为空，恒返回 false。
 */
export function hasEdgeContact(px: PixelData, margin: number): boolean {
  const { width: w, height: h, data } = px
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue
      if (x < margin || y < margin || x >= w - margin || y >= h - margin) return true
    }
  }
  return false
}
