/**
 * PixelData ↔ canvas 桥：制作桌宠向导的预览 / dataURL 导出 / 文件解码共用。
 * petImage.ts 保持纯函数（node 测试可用），所有 DOM/Canvas 依赖集中在此。
 */
import type { PixelData } from './petImage'

/** 取 2D 上下文（失败几乎不可能，集中抛错简化调用方） */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 2D 画布上下文')
  return ctx
}

/** 像素数据 → PNG data URL（离屏 canvas putImageData 后 toDataURL） */
export function pixelsToDataUrl(px: PixelData): string {
  const canvas = document.createElement('canvas')
  canvas.width = px.width
  canvas.height = px.height
  const ctx = get2dContext(canvas)
  const imageData = ctx.createImageData(px.width, px.height)
  imageData.data.set(px.data)
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

/** 像素数据 → 独立 canvas 元素（向导预览直接挂载展示用） */
export function pixelsToCanvasElement(px: PixelData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = px.width
  canvas.height = px.height
  const ctx = get2dContext(canvas)
  const imageData = ctx.createImageData(px.width, px.height)
  imageData.data.set(px.data)
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/** 已解码图像 → 像素数据（drawImage 后 getImageData 拷贝，避免复用内部缓冲区） */
export function imageToPixels(img: HTMLImageElement | ImageBitmap): PixelData {
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = get2dContext(canvas)
  ctx.drawImage(img, 0, 0)
  // getImageData 返回的 data 与内部缓冲关联，逐份拷贝保证独立持有
  const imageData = ctx.getImageData(0, 0, w, h)
  return { width: w, height: h, data: new Uint8ClampedArray(imageData.data) }
}

/**
 * 用户选择文件 → 像素数据 + 可持久使用的 url。
 * objectURL 仅用于解码，onload/onerror 后立即 revoke 防泄漏；
 * 返回的 url 为 dataURL 形式（objectURL 已回收，dataURL 可安全交给 <img> 渲染）。
 */
export function loadImageFromFile(file: File): Promise<{ pixels: PixelData; url: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = (): void => {
      try {
        const pixels = imageToPixels(img)
        const url = pixelsToDataUrl(pixels)
        URL.revokeObjectURL(objectUrl)
        resolve({ pixels, url })
      } catch (err) {
        URL.revokeObjectURL(objectUrl)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    img.onerror = (): void => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片解码失败'))
    }
    img.src = objectUrl
  })
}
