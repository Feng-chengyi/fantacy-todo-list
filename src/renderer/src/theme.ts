/**
 * v3 主题应用器：把 AppConfig 中的外观配置映射为根节点 CSS 变量 / dataset。
 * - appearance：light / dark / system（system 跟随 prefers-color-scheme，并监听变化）；
 * - themeColor/themeColorDark：亮/暗双色 accent（v3.1 修复 N3.2/F1——暗色模式不再被
 *   亮色单值内联覆盖，未自定义时回落 :root[data-theme='dark'] 预设的暗色 accent）；
 * - 背景：纯色 或 图片（+ 模糊度），经 --app-bg-* 变量由 .app-bg-layer 消费；
 * - uiOpacity：弹窗/卡片表面透明度（--panel-opacity，配合 color-mix 生效）；
 * - 切换时挂载 .theme-transition 类 220ms，令颜色/背景平滑过渡（N1.1）。
 */
import { accentPair } from '../../shared/defaults'
import type { AppConfig } from '../../shared/types'

const media = window.matchMedia('(prefers-color-scheme: dark)')

/** 主题切换过渡类：挂载后短暂启用全局颜色过渡，超时自动移除 */
let transitionTimer: number | undefined

function enableThemeTransition(root: HTMLElement): void {
  root.classList.add('theme-transition')
  window.clearTimeout(transitionTimer)
  transitionTimer = window.setTimeout(() => root.classList.remove('theme-transition'), 240)
}

export function applyTheme(cfg: AppConfig, opts?: { animate?: boolean }): void {
  const root = document.documentElement
  const appearance = cfg.appearance ?? 'system'
  const dark = appearance === 'dark' || (appearance === 'system' && media.matches)
  const prevTheme = root.dataset.theme

  root.dataset.theme = dark ? 'dark' : 'light'

  // 主题切换（亮暗翻转）时启用平滑过渡；首次应用（无 prevTheme）不动画
  if (opts?.animate !== false && prevTheme && prevTheme !== root.dataset.theme) {
    enableThemeTransition(root)
  }

  // 主题色：亮/暗双色解析（N3.2/F1/F2）。null = 未自定义 → 不内联覆盖，
  // 交由 :root[data-theme] CSS 预设（亮 #6c5ce7 / 暗 #8b7cf7）生效。
  const pair = accentPair(cfg)
  const accent = dark ? pair.dark : pair.light
  if (accent) {
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--today-ring', accent)
    root.style.setProperty('--today-bg', `color-mix(in srgb, ${accent} 12%, transparent)`)
    root.style.setProperty('--drop-bg', `color-mix(in srgb, ${accent} 22%, transparent)`)
  } else {
    root.style.removeProperty('--accent')
    root.style.removeProperty('--today-ring')
    root.style.removeProperty('--today-bg')
    root.style.removeProperty('--drop-bg')
  }

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
