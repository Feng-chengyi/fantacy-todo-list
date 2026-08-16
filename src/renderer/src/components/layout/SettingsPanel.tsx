/**
 * 设置面板：撒花开关 / 周起始 / 桌宠开关 / 番茄时长 / 数据备份导入导出。
 */
import { useState } from 'react'
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
  const showNotesInCalendar = useConfigStore((s) => s.showNotesInCalendar)
  const noteTruncateLength = useConfigStore((s) => s.noteTruncateLength)
  const update = useConfigStore((s) => s.update)
  const loadTasks = useTaskStore((s) => s.load)
  const loadConfig = useConfigStore((s) => s.load)

  const [backupMsg, setBackupMsg] = useState<string | null>(null)

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

  if (!showSettings) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={() => setShowSettings(false)}>
      <div
        className="w-[440px] rounded-xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold">设置</h2>

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
          <select
            value={weekStart}
            onChange={(e) => void update({ weekStart: Number(e.target.value) })}
            className="select"
          >
            <option value={1}>周一</option>
            <option value={0}>周日</option>
          </select>
        </label>

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

        <label className="setting-row">
          <span>日历显示任务备注</span>
          <input
            type="checkbox"
            checked={showNotesInCalendar}
            onChange={(e) => void update({ showNotesInCalendar: e.target.checked })}
          />
        </label>

        <label className="setting-row">
          <span>备注截断长度（字符）</span>
          <input
            type="number"
            min={1}
            max={200}
            className="input w-20"
            value={noteTruncateLength}
            onChange={(e) =>
              void update({ noteTruncateLength: Math.max(1, Math.min(200, Math.floor(Number(e.target.value) || 1))) })
            }
          />
        </label>

        <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
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
        </div>

        <div className="mt-5 flex justify-end">
          <button className="primary-btn" onClick={() => setShowSettings(false)}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
