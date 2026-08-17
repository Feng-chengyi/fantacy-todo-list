/**
 * 主题背景图资产 data URL 纯函数：
 * 主进程 ui-assets（选择/落盘/清理）共用，保证 MIME/扩展名映射与编解码口径唯一。
 * 注：音频扩展名保留在映射中，仅用于清理旧版本（计时页 BGM 时代）残留文件，
 * 背景选择对话框本身只允许图片。
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

/** 校验扩展名是否为受支持的资产类型 */
export function isAssetExt(ext: string): boolean {
  return ext.toLowerCase() in ASSET_MIME
}

/** 拼装 data URL（base64 载荷） */
export function buildDataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`
}
