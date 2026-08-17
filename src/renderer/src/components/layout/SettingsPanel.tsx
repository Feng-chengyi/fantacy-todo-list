/**
 * v3.1 设置面板：
 * - 主题与外观：预设包（一键换装）/ 明暗模式 / 双色主题色（亮暗独立，修复 N3.2/F1/F2）/
 *   背景（纯色/图片/模糊四档语义）/ 界面透明度 / 重置默认（N3.3）；
 * - 锚点导航（N3.6）：主题 / 通用 / 桌宠 / 数据 快速跳转；
 * - 原有能力：撒花 / 周起始 / 桌宠 / 数据备份导入导出。
 */
import { useEffect, useRef, useState } from 'react'
import {
  BG_COLOR_PRESETS,
  DEFAULT_CONFIG,
  THEME_COLOR_PRESETS,
  THEME_PRESETS,
  accentPair,
} from '../../../../shared/defaults'
import { useConfigStore } from '../../stores/configStore'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import * as ipc from '../../services/ipc'

/** 背景模糊档位语义（N3.5）：0=无 1-10=轻 11-25=中 26-40=重 */
function blurLevelLabel(v: number): string {
  if (v <= 0) return '无'
  if (v <= 10) return '轻'
  if (v <= 25) return '中'
  return '重'
}

const ANCHOR_SECTIONS: { key: string; label: string }[] = [
  { key: 'theme', label: '主题' },
  { key: 'general', label: '通用' },
  { key: 'pet', label: '桌宠' },
  { key: 'data', label: '数据' },
]

export function SettingsPanel() {
  const showSettings = useUiStore((s) => s.showSettings)
  const setShowSettings = useUiStore((s) => s.setShowSettings)
  const setShowPetMaker = useUiStore((s) => s.setShowPetMaker)
  const confettiEnabled = useConfigStore((s) => s.confettiEnabled)
  const weekStart = useConfigStore((s) => s.weekStart)
  const petVisible = useConfigStore((s) => s.petVisible)
  const appearance = useConfigStore((s) => s.appearance ?? 'system')
  const themeColor = useConfigStore((s) => s.themeColor ?? '#6c5ce7')
  const themeColorDark = useConfigStore((s) => s.themeColorDark)
  const themePresetId = useConfigStore((s) => s.themePresetId)
  const bgMode = useConfigStore((s) => s.bgMode ?? 'plain')
  const bgColor = useConfigStore((s) => s.bgColor ?? '#f7f8fa')
  const bgImage = useConfigStore((s) => s.bgImage)
  const bgBlur = useConfigStore((s) => s.bgBlur ?? 0)
  const uiOpacity = useConfigStore((s) => s.uiOpacity ?? 1)
  const update = useConfigStore((s) => s.update)
  const loadTasks = useTaskStore((s) => s.load)
  const loadConfig = useConfigStore((s) => s.load)

  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [bgMsg, setBgMsg] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // 当前双色 accent（active 判定与实际写入保持一致，修复 F2）
  const activePair = accentPair({ themeColor, themeColorDark })

  const onExport = async (): Promise<void> => {
    const res = await ipc.exportData()
    if (res.canceled) setBackupMsg('已取消导出')
    else if (res.error) setBackupMsg(`导出失败：${res.error}`)
    else setBackupMsg(`已导出到 ${res.path}`)
  }

  const onImport = async (): Promise<void> => {
    const res = await ipc.importData()
    if (res.canceled) {
      setBackupMsg('已取消导入')
      return
    }
    if (res.error) {
      setBackupMsg(`导入失败：${res.error}`)
      return
    }
    // 导入成功后刷新两 store 快照
    await loadTasks()
    await loadConfig()
    setBackupMsg('导入成功')
  }

  const onPickBg = async (): Promise<void> => {
    const res = await ipc.pickBgImage()
    if (res.canceled) return
    if (res.dataUrl) {
      await update({ bgImage: res.dataUrl, bgMode: 'image' })
      setBgMsg('背景图已设置')
    } else {
      setBgMsg('背景图读取失败')
    }
  }

  const onClearBg = async (): Promise<void> => {
    await ipc.clearBgImage()
    await update({ bgImage: null, bgMode: 'plain' })
    setBgMsg('已恢复纯色背景')
  }

  /** 主题重置默认（N3.3）：外观组合整体回到出厂值 */
  const onResetTheme = async (): Promise<void> => {
    if (bgImage) await ipc.clearBgImage()
    await update({
      appearance: DEFAULT_CONFIG.appearance,
      themeColor: DEFAULT_CONFIG.themeColor,
      themeColorDark: DEFAULT_CONFIG.themeColorDark,
      themePresetId: undefined,
      bgMode: 'plain',
      bgColor: DEFAULT_CONFIG.bgColor,
      bgImage: null,
      bgBlur: 0,
      uiOpacity: 1,
    })
    setBgMsg('主题已重置为默认')
  }

  /** 应用主题预设包（N3.1）：明暗 + 双色 accent + 背景色一键切换 */
  const onApplyPack = (id: string): void => {
    const pack = THEME_PRESETS.find((p) => p.id === id)
    if (!pack) return
    void update({
      themePresetId: pack.id,
      appearance: pack.appearance,
      themeColor: pack.themeColor,
      themeColorDark: pack.themeColorDark,
      bgColor: pack.bgColor,
      bgMode: 'plain',
    })
  }

  /** 锚点跳转（N3.6）：滚动到对应分区标题 */
  const scrollToSection = (key: string): void => {
    const panel = panelRef.current
    if (!panel) return
    const target = panel.querySelector<HTMLElement>(`[data-anchor="${key}"]`)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ESC 快捷关闭（全局弹窗交互规范）
  useEffect(() => {
    if (!showSettings) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShowSettings(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSettings, setShowSettings])

  if (!showSettings) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={() => setShowSettings(false)}>
      <div
        ref={panelRef}
        className="max-h-[86vh] w-[460px] overflow-y-auto rounded-xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-bold">设置</h2>

        {/* 锚点导航（N3.6） */}
        <div className="settings-anchor-nav">
          {ANCHOR_SECTIONS.map((s) => (
            <button key={s.key} onClick={() => scrollToSection(s.key)}>
              {s.label}
            </button>
          ))}
        </div>

        {/* ============ 主题与外观（v3.1） ============ */}
        <div className="setting-subhead" data-anchor="theme" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
          主题与外观
        </div>

        <div className="setting-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
          <span>主题预设</span>
          <div className="theme-pack-grid">
            {THEME_PRESETS.map((pack) => (
              <button
                key={pack.id}
                className={`theme-pack ${themePresetId === pack.id ? 'active' : ''}`}
                title={`${pack.name}：${pack.appearance === 'dark' ? '暗色' : pack.appearance === 'light' ? '亮色' : '跟随系统'} · ${pack.bgColor}`}
                onClick={() => onApplyPack(pack.id)}
              >
                <span className="theme-pack-dot" style={{ background: pack.themeColor }} />
                <span className="theme-pack-name">
                  {pack.emoji} {pack.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="setting-row">
          <span>明暗模式</span>
          <div className="filter-tabs">
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <button key={mode} className={appearance === mode ? 'active' : ''} onClick={() => void update({ appearance: mode })}>
                {mode === 'light' ? '亮色' : mode === 'dark' ? '暗色' : '跟随系统'}
              </button>
            ))}
          </div>
        </label>

        <div className="setting-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
          <span>主题色（亮 / 暗双色跟随）</span>
          <div className="theme-preset-grid">
            {THEME_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                className={`theme-color-dot ${activePair.light === preset.light && activePair.dark === preset.dark ? 'active' : ''}`}
                style={{ background: preset.light }}
                title={`${preset.name}（暗色模式自动切换 ${preset.dark}）`}
                onClick={() => void update({ themeColor: preset.light, themeColorDark: preset.dark, themePresetId: undefined })}
              />
            ))}
            <label
              className="theme-color-dot"
              title="自定义主题色（亮暗共用）"
              style={{
                background: themeColor || 'conic-gradient(#e5484d,#f5a623,#22c55e,#3b82f6,#8b5cf6,#e5484d)',
                border: '1px dashed var(--border)',
              }}
            >
              <input
                type="color"
                className="color-input"
                value={/^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : '#6c5ce7'}
                onChange={(e) => void update({ themeColor: e.target.value, themeColorDark: e.target.value, themePresetId: undefined })}
              />
            </label>
          </div>
        </div>

        <div className="setting-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
          <span>背景</span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="filter-tabs">
              <button className={bgMode === 'plain' ? 'active' : ''} onClick={() => void update({ bgMode: 'plain' })}>
                纯色
              </button>
              <button className={bgMode === 'image' ? 'active' : ''} onClick={() => void update({ bgMode: bgImage ? 'image' : 'plain' })}>
                图片
              </button>
            </div>
            <label
              className="color-swatch color-swatch-custom"
              title="自定义背景色"
              style={{ background: bgColor, border: '1px solid var(--border)' }}
            >
              <input type="color" className="color-input" value={bgColor} onChange={(e) => void update({ bgColor: e.target.value })} />
            </label>
            {BG_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                className={`theme-bg-dot ${bgMode === 'plain' && bgColor === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => void update({ bgColor: c, bgMode: 'plain' })}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="ghost-btn" style={{ height: 26, fontSize: 12 }} onClick={() => void onPickBg()}>
              上传背景图
            </button>
            {bgImage && (
              <button className="ghost-btn" style={{ height: 26, fontSize: 12 }} onClick={() => void onClearBg()}>
                清除背景图
              </button>
            )}
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              模糊
              <input
                type="range"
                min={0}
                max={40}
                value={bgBlur}
                className="setting-slider"
                style={{ width: 90 }}
                onChange={(e) => void update({ bgBlur: Number(e.target.value) })}
              />
              {/* 四档语义标注（N3.5）：无 / 轻 / 中 / 重 */}
              <span className="blur-level-label" title="模糊四档：无 0 · 轻 1-10 · 中 11-25 · 重 26-40">
                {blurLevelLabel(bgBlur)}
              </span>
            </label>
          </div>
          {bgMsg && (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {bgMsg}
            </div>
          )}
        </div>

        <label className="setting-row">
          <span>界面透明度</span>
          <span className="flex items-center gap-2">
            <input
              type="range"
              min={50}
              max={100}
              value={Math.round(uiOpacity * 100)}
              className="setting-slider"
              onChange={(e) => void update({ uiOpacity: Number(e.target.value) / 100 })}
            />
            <b style={{ color: 'var(--accent)', minWidth: 34, textAlign: 'right' }}>{Math.round(uiOpacity * 100)}%</b>
          </span>
        </label>

        <div className="setting-row">
          <span />
          <button className="setting-reset-btn" onClick={() => void onResetTheme()} title="外观组合整体恢复出厂值">
            ↺ 重置主题到默认
          </button>
        </div>

        {/* ============ 通用 ============ */}
        <div className="setting-subhead" data-anchor="general">
          通用
        </div>

        <label className="setting-row">
          <span>完成时撒花</span>
          <input
            type="checkbox"
            checked={confettiEnabled}
            onChange={(e) => void update({ confettiEnabled: e.target.checked })}
          />
        </label>

        <label className="setting-row">
          <span>一周起始日</span>
          <select value={weekStart} onChange={(e) => void update({ weekStart: Number(e.target.value) })} className="select">
            <option value={1}>周一</option>
            <option value={0}>周日</option>
          </select>
        </label>

        {/* ============ 桌宠 ============ */}
        <div className="setting-subhead" data-anchor="pet">
          桌宠
        </div>

        <label className="setting-row">
          <span>显示桌宠</span>
          <input
            type="checkbox"
            checked={petVisible}
            onChange={(e) => {
              const checked = e.target.checked
              // 更新本地状态/持久化 + 触发桌宠窗口显隐（与托盘、右键菜单行为一致）
              void update({ petVisible: checked })
              void ipc.setPetVisible(checked)
            }}
          />
        </label>

        <div className="setting-row">
          <span>制作桌宠</span>
          <button
            className="primary-btn"
            onClick={() => {
              // 打开向导并收起设置面板（同层弹层互斥）
              setShowSettings(false)
              setShowPetMaker(true)
            }}
          >
            打开向导
          </button>
        </div>

        {/* ============ 数据 ============ */}
        <div className="setting-subhead" data-anchor="data">
          数据
        </div>

        <div className="flex gap-2">
          <button className="ghost-btn" onClick={() => void onExport()}>
            导出备份
          </button>
          <button className="ghost-btn" onClick={() => void onImport()}>
            导入备份
          </button>
        </div>
        {backupMsg && (
          <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {backupMsg}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button className="primary-btn" onClick={() => setShowSettings(false)}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
