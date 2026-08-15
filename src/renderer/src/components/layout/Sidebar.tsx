/**
 * 左侧栏：收集箱入口 + 筛选（全部/未完成/已放弃）。
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
  const inboxCount = useTaskStore((s) => s.tasks.filter((t) => t.date === null && t.status !== 'abandoned').length)

  return (
    <aside
      className="flex w-48 shrink-0 flex-col gap-1 border-r p-3"
      style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
    >
      <button
        className={`side-item ${showInbox ? 'active' : ''}`}
        onClick={() => setShowInbox(!showInbox)}
      >
        <span>📥 收集箱</span>
        {inboxCount > 0 && <span className="badge">{inboxCount}</span>}
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
