/**
 * 计时器资产（背景图 / BGM）data URL 纯函数：
 * 主进程 timer-assets（选择/加载）与 backup（导出/导入内联资产）共用，
 * 保证 MIME/扩展名映射与编解码口径唯一。
 */

/** 扩展名 → MIME（data URL 用） */
export const ASSET_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
}

/** MIME → 扩展名（备份恢复落盘用）；未知返回 null */
export function extOfMime(mime: string): string | null {
  for (const [ext, m] of Object.entries(ASSET_MIME)) {
    if (m === mime) return ext
  }
  return null
}

/** 校验扩展名是否为受支持的资产类型 */
export function isAssetExt(ext: string): boolean {
  return ext.toLowerCase() in ASSET_MIME
}

/** 拼装 data URL（base64 载荷） */
export function buildDataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`
}

/** 解析 data URL；非法格式返回 null */
export function parseDataUrl(url: string): { mime: string; base64: string } | null {
  const m = /^data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(url.trim())
  if (!m) return null
  return { mime: m[1], base64: m[2] }
}
