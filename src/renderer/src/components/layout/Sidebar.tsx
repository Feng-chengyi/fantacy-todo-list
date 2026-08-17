/**
 * 左侧栏：一级导航（待办/收集箱/时间轴/统计/习惯/倒数日/计时）+
 * 筛选（全部/未完成/已完成/已放弃，作用于待办任务仓库与收集箱）。
 * 使用说明入口唯一化：仅保留顶部工具栏「帮助」，侧栏不再重复。
 */
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore, type Page, type TaskFilter } from '../../stores/uiStore'

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '未完成' },
  { key: 'done', label: '已完成' },
  { key: 'abandoned', label: '已放弃' },
]

const NAV_ITEMS: { key: Page; label: string }[] = [
  { key: 'todo', label: '✅ 待办' },
  { key: 'inbox', label: '📥 收集箱' },
  { key: 'timeline', label: '🗓 时间轴' },
  { key: 'stats', label: '📊 统计' },
  { key: 'habits', label: '🎯 习惯' },
  { key: 'goals', label: '⏳ 倒数日' },
  { key: 'timer', label: '⏱ 计时' },
]

export function Sidebar() {
  const filter = useUiStore((s) => s.filter)
  const setFilter = useUiStore((s) => s.setFilter)
  const page = useUiStore((s) => s.page)
  const setPage = useUiStore((s) => s.setPage)
  const timerRunning = useUiStore((s) => s.timer !== null)
  const inboxCount = useTaskStore((s) => s.tasks.filter((t) => t.date === null && t.status !== 'abandoned').length)

  return (
    <aside
      className="flex w-48 shrink-0 flex-col gap-1 border-r p-3"
      style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={`side-item ${page === item.key ? 'active' : ''}`}
          onClick={() => setPage(item.key)}
        >
          <span>{item.label}</span>
          {item.key === 'inbox' && inboxCount > 0 && <span className="badge">{inboxCount}</span>}
          {item.key === 'timer' && timerRunning && <span className="badge">●</span>}
        </button>
      ))}

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
