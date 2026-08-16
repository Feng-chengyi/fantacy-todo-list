/**
 * 左侧栏：收集箱入口 + 习惯 / 倒数日 + 筛选（全部/未完成/已放弃）。
 */
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore, type TaskFilter } from '../../stores/uiStore'

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '未完成' },
  { key: 'done', label: '已完成' },
  { key: 'abandoned', label: '已放弃' },
]

export function Sidebar() {
  const filter = useUiStore((s) => s.filter)
  const setFilter = useUiStore((s) => s.setFilter)
  const showInbox = useUiStore((s) => s.showInbox)
  const setShowInbox = useUiStore((s) => s.setShowInbox)
  const showStats = useUiStore((s) => s.showStats)
  const setShowStats = useUiStore((s) => s.setShowStats)
  const showHabits = useUiStore((s) => s.showHabits)
  const setShowHabits = useUiStore((s) => s.setShowHabits)
  const showGoals = useUiStore((s) => s.showGoals)
  const setShowGoals = useUiStore((s) => s.setShowGoals)
  const showTimer = useUiStore((s) => s.showTimer)
  const setShowTimer = useUiStore((s) => s.setShowTimer)
  const timerRunning = useUiStore((s) => s.timer !== null)
  const inboxCount = useTaskStore((s) => s.tasks.filter((t) => t.date === null && t.status !== 'abandoned').length)

  const closeOthers = (): void => {
    setShowInbox(false)
    setShowStats(false)
    setShowHabits(false)
    setShowGoals(false)
    setShowTimer(false)
  }

  const openInbox = (): void => {
    closeOthers()
    setShowInbox(!showInbox)
  }

  const openStats = (): void => {
    closeOthers()
    setShowStats(!showStats)
  }

  const openHabits = (): void => {
    closeOthers()
    setShowHabits(!showHabits)
  }

  const openGoals = (): void => {
    closeOthers()
    setShowGoals(!showGoals)
  }

  const openTimer = (): void => {
    closeOthers()
    setShowTimer(!showTimer)
  }

  return (
    <aside
      className="flex w-48 shrink-0 flex-col gap-1 border-r p-3"
      style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
    >
      <button className={`side-item ${showInbox ? 'active' : ''}`} onClick={openInbox}>
        <span>📥 收集箱</span>
        {inboxCount > 0 && <span className="badge">{inboxCount}</span>}
      </button>

      <button className={`side-item ${showStats ? 'active' : ''}`} onClick={openStats}>
        <span>📊 统计</span>
      </button>

      <button className={`side-item ${showHabits ? 'active' : ''}`} onClick={openHabits}>
        <span>🎯 习惯</span>
      </button>

      <button className={`side-item ${showGoals ? 'active' : ''}`} onClick={openGoals}>
        <span>⏳ 倒数日</span>
      </button>

      <button className={`side-item ${showTimer ? 'active' : ''}`} onClick={openTimer}>
        <span>⏱ 计时</span>
        {timerRunning && <span className="badge">●</span>}
      </button>

      <div className="mt-4 mb-1 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        筛选
      </div>
      {FILTERS.map((f) => (
        <button
          key={f.key}
          className={`side-item ${filter === f.key ? 'active' : ''}`}
          onClick={() => setFilter(f.key)}
        >
          {f.label}
        </button>
      ))}
    </aside>
  )
}
