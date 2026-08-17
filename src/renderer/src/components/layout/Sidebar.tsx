/**
 * v3 左侧栏：一级导航仅 5 个核心入口（固定顺序）：
 * 待办 / 待办集 / 时间轴 / 统计 / 倒数日。
 * 习惯·目标为任务类型标签（待办页筛选查看）；收集箱并入待办集（系统内置首项）；
 * 计时下沉为待办附属动作（悬浮窗常驻）——均不再占用一级导航。
 */
import { useUiStore, type Page } from '../../stores/uiStore'

const NAV_ITEMS: { key: Page; label: string }[] = [
  { key: 'todo', label: '✅ 待办' },
  { key: 'collections', label: '🗂 待办集' },
  { key: 'timeline', label: '🗓 时间轴' },
  { key: 'stats', label: '📊 统计' },
  { key: 'goals', label: '⏳ 倒数日' },
]

export function Sidebar() {
  const page = useUiStore((s) => s.page)
  const setPage = useUiStore((s) => s.setPage)

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
        </button>
      ))}
    </aside>
  )
}
