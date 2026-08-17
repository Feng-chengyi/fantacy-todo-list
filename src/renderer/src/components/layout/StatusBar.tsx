/**
 * 页脚状态栏（P1-5）：今日完成 / 今日专注 / 桌宠与计时状态 / 版本号。
 * 轻量信息层，不做任何交互入口。
 */
import { useMemo } from 'react'
import { summarizeDay } from '../../../../shared/sessionView'
import { formatDurationCompact } from '../../../../shared/time'
import { todayStr } from '../../../../shared/date'
import { useConfigStore } from '../../stores/configStore'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'

/** 与 package.json 保持同步（打包脚本读取同一版本号） */
const APP_VERSION = '3.1.0'

export function StatusBar() {
  const tasks = useTaskStore((s) => s.tasks)
  const sessions = useTaskStore((s) => s.sessions)
  const petVisible = useConfigStore((s) => s.petVisible)
  const timer = useUiStore((s) => s.timer)

  const today = todayStr()
  const doneToday = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== 'done' || !t.completedAt) return false
      const d = new Date(t.completedAt)
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return local === today
    }).length
  }, [tasks, today])

  const focus = useMemo(() => summarizeDay(sessions, today), [sessions, today])

  return (
    <footer className="status-bar">
      <span className="status-bar-item">
        ✅ 今日完成 <b>{doneToday}</b>
      </span>
      <span className="status-bar-item">
        ⏱ 专注 <b>{focus.count}</b> 次 · <b>{formatDurationCompact(focus.totalSec)}</b>
      </span>
      <span className="status-bar-spacer" />
      <span className="status-bar-item" title={timer ? '计时进行中' : '当前无计时'}>
        <i className={`status-bar-dot ${timer ? 'rec' : ''}`} />
        {timer ? '计时中' : '就绪'}
      </span>
      <span className="status-bar-item" title={petVisible ? '桌宠陪伴中' : '桌宠已隐藏'}>
        {petVisible ? '🐾 桌宠在岗' : '🐾 桌宠休息'}
      </span>
      <span className="status-bar-item">v{APP_VERSION}</span>
    </footer>
  )
}
