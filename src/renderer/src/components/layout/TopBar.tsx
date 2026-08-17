/**
 * v3 顶部栏：应用名 + 当前页面标题 + 业务入口（搜索 / 帮助 / 设置）。
 * 窗口最小化/最大化/关闭完全交由操作系统原生标题栏处理，
 * 页面内不再保留自定义窗口控制按钮（弹窗内「关闭×」为弹窗业务控件，不在此列）。
 */
import { useUiStore } from '../../stores/uiStore'

const PAGE_TITLES: Record<string, string> = {
  todo: '待办',
  collections: '待办集',
  timeline: '时间轴',
  stats: '统计',
  goals: '倒数日',
}

export function TopBar() {
  const page = useUiStore((s) => s.page)
  const setShowSearch = useUiStore((s) => s.setShowSearch)
  const setShowHelp = useUiStore((s) => s.setShowHelp)
  const setShowSettings = useUiStore((s) => s.setShowSettings)

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-3 border-b px-4"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      <h1 className="text-sm font-bold tracking-wide" style={{ color: 'var(--accent)' }}>
        Fantacy Todo
      </h1>

      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {PAGE_TITLES[page] ?? ''}
      </span>

      <div className="flex-1" />

      <button className="text-btn" onClick={() => setShowSearch(true)} title="全局搜索">
        🔍 搜索
      </button>
      <button className="text-btn" onClick={() => setShowHelp(true)} title="使用说明">
        帮助
      </button>
      <button className="text-btn" onClick={() => setShowSettings(true)}>
        设置
      </button>
    </header>
  )
}
