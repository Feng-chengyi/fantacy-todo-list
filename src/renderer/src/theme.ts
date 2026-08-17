/**
 * v3 主题应用器：把 AppConfig 中的外观配置映射为根节点 CSS 变量 / dataset。
 * - appearance：light / dark / system（system 跟随 prefers-color-scheme，并监听变化）；
 * - themeColor：全局主色（accent / today-ring / drop 系列）；
 * - 背景：纯色 或 图片（+ 模糊度），经 --app-bg-* 变量由 .app-bg-layer 消费；
 * - uiOpacity：弹窗/卡片表面透明度（--panel-opacity，配合 color-mix 生效）。
 */
import { DEFAULT_CONFIG } from '../../shared/defaults'
import type { AppConfig } from '../../shared/types'

const media = window.matchMedia('(prefers-color-scheme: dark)')

export function applyTheme(cfg: AppConfig): void {
  const root = document.documentElement
  const appearance = cfg.appearance ?? 'system'
  const dark = appearance === 'dark' || (appearance === 'system' && media.matches)

  root.dataset.theme = dark ? 'dark' : 'light'

  // 主题色（未设置回退默认品牌紫）
  const accent = cfg.themeColor ?? DEFAULT_CONFIG.themeColor ?? '#6c5ce7'
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--today-ring', accent)
  root.style.setProperty('--today-bg', `color-mix(in srgb, ${accent} 12%, transparent)`)
  root.style.setProperty('--drop-bg', `color-mix(in srgb, ${accent} 22%, transparent)`)

  // 背景
  const bgMode = cfg.bgMode ?? 'plain'
  const hasImage = bgMode === 'image' && !!cfg.bgImage
  root.style.setProperty('--app-bg-image', hasImage ? `url("${cfg.bgImage}")` : 'none')
  root.style.setProperty('--app-bg-color', hasImage ? '#17181c' : cfg.bgColor ?? '#f7f8fa')
  root.style.setProperty('--app-bg-blur', `${Math.max(0, Math.min(40, cfg.bgBlur ?? 0))}px`)

  // 表面透明度（0.5-1）
  const opacity = Math.max(0.5, Math.min(1, cfg.uiOpacity ?? 1))
  root.style.setProperty('--panel-opacity', String(opacity))
}

/** 订阅系统明暗变化（appearance=system 时实时切换）；返回取消函数 */
export function watchSystemTheme(onChange: () => void): () => void {
  const listener = (): void => onChange()
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
