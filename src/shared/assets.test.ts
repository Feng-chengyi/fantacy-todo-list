/**
 * 计时器资产 data URL 纯函数单测（QA Bug 3：备份内联资产编解码口径）。
 */
import { describe, expect, it } from 'vitest'
import { ASSET_MIME, buildDataUrl, extOfMime, isAssetExt, parseDataUrl } from './assets'

describe('ASSET_MIME / extOfMime 映射', () => {
  it('常见图片扩展名映射到图片 MIME', () => {
    expect(ASSET_MIME['.png']).toBe('image/png')
    expect(ASSET_MIME['.jpg']).toBe('image/jpeg')
    expect(ASSET_MIME['.webp']).toBe('image/webp')
  })

  it('常见音频扩展名映射到音频 MIME', () => {
    expect(ASSET_MIME['.mp3']).toBe('audio/mpeg')
    expect(ASSET_MIME['.wav']).toBe('audio/wav')
    expect(ASSET_MIME['.flac']).toBe('audio/flac')
  })

  it('extOfMime 已知 MIME 返回扩展名，未知返回 null', () => {
    expect(extOfMime('image/png')).toBe('.png')
    expect(extOfMime('audio/mpeg')).toBe('.mp3')
    expect(extOfMime('application/pdf')).toBeNull()
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

describe('buildDataUrl / parseDataUrl 往返', () => {
  it('拼装并还原（mime 与 base64 载荷一致）', () => {
    const url = buildDataUrl('image/png', 'aGVsbG8=')
    expect(url).toBe('data:image/png;base64,aGVsbG8=')
    const parsed = parseDataUrl(url)
    expect(parsed).toEqual({ mime: 'image/png', base64: 'aGVsbG8=' })
  })

  it('parseDataUrl 非法输入返回 null', () => {
    expect(parseDataUrl('https://example.com/a.png')).toBeNull()
    expect(parseDataUrl('data:image/png,no-base64')).toBeNull()
    expect(parseDataUrl('data:;base64,')).toBeNull()
    expect(parseDataUrl('')).toBeNull()
    expect(parseDataUrl('data:image/png;base64,a b c')).toBeNull()
  })

  it('parseDataUrl 容忍首尾空白', () => {
    expect(parseDataUrl('  data:audio/wav;base64,QUJD  ')).toEqual({
      mime: 'audio/wav',
      base64: 'QUJD',
    })
  })
})
