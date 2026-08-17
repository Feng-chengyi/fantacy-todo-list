/**
 * v3 设置面板：
 * - 主题与外观：明暗模式 / 主题色 / 背景（纯色/图片/模糊） / 界面透明度（本地持久化）；
 * - 原有能力：撒花 / 周起始 / 桌宠 / 番茄时长 / 数据备份导入导出。
 */
import { useState } from 'react'
import { BG_COLOR_PRESETS, THEME_COLOR_PRESETS } from '../../../../shared/defaults'
import { useConfigStore } from '../../stores/configStore'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import * as ipc from '../../services/ipc'

export function SettingsPanel() {
  const showSettings = useUiStore((s) => s.showSettings)
  const setShowSettings = useUiStore((s) => s.setShowSettings)
  const setShowPetMaker = useUiStore((s) => s.setShowPetMaker)
  const confettiEnabled = useConfigStore((s) => s.confettiEnabled)
  const weekStart = useConfigStore((s) => s.weekStart)
  const petVisible = useConfigStore((s) => s.petVisible)
  const focusMinutes = useConfigStore((s) => s.pomodoroFocusMinutes)
  const breakMinutes = useConfigStore((s) => s.pomodoroBreakMinutes)
  const appearance = useConfigStore((s) => s.appearance ?? 'system')
  const themeColor = useConfigStore((s) => s.themeColor ?? '#6c5ce7')
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

  if (!showSettings) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={() => setShowSettings(false)}>
      <div
        className="max-h-[86vh] w-[460px] overflow-y-auto rounded-xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold">设置</h2>

        {/* ============ 主题与外观（v3） ============ */}
        <div className="setting-subhead" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
          主题与外观
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
          <span>主题色</span>
          <div className="theme-preset-grid">
            {THEME_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                className={`theme-color-dot ${themeColor === preset.light || themeColor === preset.dark ? 'active' : ''}`}
                style={{ background: preset.light }}
                title={preset.name}
                onClick={() => void update({ themeColor: preset.light })}
              />
            ))}
            <label
              className="theme-color-dot"
              title="自定义主题色"
              style={{
                background: themeColor || 'conic-gradient(#e5484d,#f5a623,#22c55e,#3b82f6,#8b5cf6,#e5484d)',
                border: '1px dashed var(--border)',
              }}
            >
              <input
                type="color"
                className="color-input"
                value={/^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : '#6c5ce7'}
                onChange={(e) => void update({ themeColor: e.target.value })}
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

        {/* ============ 通用 ============ */}
        <div className="setting-subhead">通用</div>

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
        <div className="setting-subhead">桌宠</div>

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

        {/* ============ 计时 ============ */}
        <div className="setting-subhead">计时</div>

        <label className="setting-row">
          <span>番茄·专注时长（分钟）</span>
          <input
            type="number"
            min={1}
            className="input w-20"
            value={focusMinutes}
            onChange={(e) => void update({ pomodoroFocusMinutes: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
          />
        </label>

        <label className="setting-row">
          <span>番茄·休息时长（分钟）</span>
          <input
            type="number"
            min={1}
            className="input w-20"
            value={breakMinutes}
            onChange={(e) => void update({ pomodoroBreakMinutes: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
          />
        </label>

        {/* ============ 数据 ============ */}
        <div className="setting-subhead">数据</div>

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
