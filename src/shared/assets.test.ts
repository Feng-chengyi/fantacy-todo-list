/**
 * 主题背景图资产 data URL 纯函数单测（MIME 映射 + data URL 拼装口径）。
 */
import { describe, expect, it } from 'vitest'
import { ASSET_MIME, buildDataUrl, isAssetExt } from './assets'

describe('ASSET_MIME 映射', () => {
  it('常见图片扩展名映射到图片 MIME', () => {
    expect(ASSET_MIME['.png']).toBe('image/png')
    expect(ASSET_MIME['.jpg']).toBe('image/jpeg')
    expect(ASSET_MIME['.webp']).toBe('image/webp')
  })

  it('音频扩展名保留映射（清理旧版计时页 BGM 残留文件用）', () => {
    expect(ASSET_MIME['.mp3']).toBe('audio/mpeg')
    expect(ASSET_MIME['.wav']).toBe('audio/wav')
    expect(ASSET_MIME['.flac']).toBe('audio/flac')
  })
})

describe('isAssetExt', () => {
  it('大小写不敏感判断受支持类型', () => {
    expect(isAssetExt('.png')).toBe(true)
    expect(isAssetExt('.PNG')).toBe(true)
    expect(isAssetExt('.Mp3')).toBe(true)
  })
  it('不支持的类型返回 false', () => {
    expect(isAssetExt('.txt')).toBe(false)
    expect(isAssetExt('.exe')).toBe(false)
    expect(isAssetExt('')).toBe(false)
  })
})

describe('buildDataUrl', () => {
  it('按「data:mime;base64,载荷」格式拼装', () => {
    expect(buildDataUrl('image/png', 'aGVsbG8=')).toBe('data:image/png;base64,aGVsbG8=')
  })
})
