/**
 * 顶部栏：应用名 + 视图切换（月/周）+ 翻页 + 今天 + 番茄 + 设置 + 窗口控制。
 */
import { format } from 'date-fns'
import { parseLocal, todayStr, weekDates } from '../../../../shared/date'
import { useConfigStore } from '../../stores/configStore'
import { useUiStore } from '../../stores/uiStore'
import * as ipc from '../../services/ipc'

export function TopBar() {
  const currentYear = useUiStore((s) => s.currentYear)
  const currentMonth = useUiStore((s) => s.currentMonth)
  const nextMonth = useUiStore((s) => s.nextMonth)
  const prevMonth = useUiStore((s) => s.prevMonth)
  const goToday = useUiStore((s) => s.goToday)
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)
  const prevWeek = useUiStore((s) => s.prevWeek)
  const nextWeek = useUiStore((s) => s.nextWeek)
  const selectedDate = useUiStore((s) => s.selectedDate)
  const setShowSettings = useUiStore((s) => s.setShowSettings)
  const setShowPomodoro = useUiStore((s) => s.setShowPomodoro)
  const weekStart = useConfigStore((s) => s.weekStart)

  const isWeek = view === 'week'

  let label: string
  if (isWeek) {
    const days = weekDates(selectedDate ?? todayStr(), weekStart)
    label = `${format(parseLocal(days[0]), 'M 月 d 日')} – ${format(parseLocal(days[6]), 'M 月 d 日')}`
  } else {
    label = format(new Date(currentYear, currentMonth, 1), 'yyyy 年 M 月')
  }

  const onPrev = isWeek ? prevWeek : prevMonth
  const onNext = isWeek ? nextWeek : nextMonth

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-3 border-b px-4"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      <h1 className="text-sm font-bold tracking-wide" style={{ color: 'var(--accent)' }}>
        Fantacy Todo
      </h1>

      <div className="view-tabs">
        <button className={!isWeek ? 'active' : ''} onClick={() => setView('month')}>
          月
        </button>
        <button className={isWeek ? 'active' : ''} onClick={() => setView('week')}>
          周
        </button>
      </div>

      <div className="mx-2 flex items-center gap-1">
        <button className="nav-btn" onClick={onPrev} aria-label="上一页">
          ‹
        </button>
        <span className="w-44 text-center text-sm font-semibold">{label}</span>
        <button className="nav-btn" onClick={onNext} aria-label="下一页">
          ›
        </button>
      </div>

      <button className="text-btn" onClick={goToday}>
        今天
      </button>

      <div className="flex-1" />

      <button className="text-btn" onClick={() => setShowPomodoro(true)} title="番茄钟">
        🍅 番茄
      </button>
      <button className="text-btn" onClick={() => setShowSettings(true)}>
        设置
      </button>
      <button className="text-btn" onClick={() => void ipc.minimize()} aria-label="最小化">
        —
      </button>
      <button className="text-btn hover:bg-red-500/10" onClick={() => void ipc.close()} aria-label="关闭">
        ✕
      </button>
    </header>
  )
}
