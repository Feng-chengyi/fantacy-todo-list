import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, THEME_PRESETS, accentPair } from './defaults'

describe('accentPair 亮暗双色 accent 解析（N3.2/F1/F2）', () => {
  it('显式双色优先原样返回', () => {
    const pair = accentPair({ themeColor: '#3b82f6', themeColorDark: '#60a5fa' })
    expect(pair).toEqual({ light: '#3b82f6', dark: '#60a5fa' })
  })

  it('只有亮色值时按预设表反查暗色变体（旧配置兼容：默认紫 → 暗紫）', () => {
    const pair = accentPair({ themeColor: '#6c5ce7' })
    expect(pair.light).toBe('#6c5ce7')
    expect(pair.dark).toBe('#8b7cf7')
  })

  it('自定义亮色（不在预设表）暗色回落同色', () => {
    const pair = accentPair({ themeColor: '#123456' })
    expect(pair).toEqual({ light: '#123456', dark: '#123456' })
  })

  it('完全未设置时返回 null/null（不内联覆盖，CSS 预设生效）', () => {
    expect(accentPair({})).toEqual({ light: null, dark: null })
  })

  it('默认配置解析为品牌紫亮暗双色（暗色模式不再恒亮）', () => {
    const pair = accentPair(DEFAULT_CONFIG)
    expect(pair.light).toBe('#6c5ce7')
    expect(pair.dark).toBe('#8b7cf7')
  })
})

describe('THEME_PRESETS 主题预设包（N3.1）', () => {
  it('包含 5 套预设且 id 唯一', () => {
    expect(THEME_PRESETS).toHaveLength(5)
    expect(new Set(THEME_PRESETS.map((p) => p.id)).size).toBe(5)
  })

  it('每套预设字段完整（appearance 合法、色值为 hex）', () => {
    const hex = /^#[0-9a-fA-F]{6}$/
    for (const p of THEME_PRESETS) {
      expect(['light', 'dark', 'system']).toContain(p.appearance)
      expect(hex.test(p.themeColor)).toBe(true)
      expect(hex.test(p.themeColorDark)).toBe(true)
      expect(hex.test(p.bgColor)).toBe(true)
      expect(p.name.length).toBeGreaterThan(0)
    }
  })
})
