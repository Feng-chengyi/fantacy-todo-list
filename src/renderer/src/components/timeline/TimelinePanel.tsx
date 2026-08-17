/**
 * 时间轴页面：承载月/周/日/列表日历视图与历史任务时间线复盘。
 * 原 TopBar 的视图切换标签与翻页控件迁移至此，与待办首页的场景（未来规划）分离。
 */
import { format } from 'date-fns'
import { parseLocal, todayStr, weekDates } from '../../../../shared/date'
import { useConfigStore } from '../../stores/configStore'
import { useUiStore } from '../../stores/uiStore'
import { MonthCalendar } from '../calendar/MonthCalendar'
import { WeekView } from '../calendar/WeekView'
import { DayView } from '../calendar/DayView'
import { ListView } from '../calendar/ListView'

export function TimelinePanel() {
  const currentYear = useUiStore((s) => s.currentYear)
  const currentMonth = useUiStore((s) => s.currentMonth)
  const nextMonth = useUiStore((s) => s.nextMonth)
  const prevMonth = useUiStore((s) => s.prevMonth)
  const goToday = useUiStore((s) => s.goToday)
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)
  const prevWeek = useUiStore((s) => s.prevWeek)
  const nextWeek = useUiStore((s) => s.nextWeek)
  const prevDay = useUiStore((s) => s.prevDay)
  const nextDay = useUiStore((s) => s.nextDay)
  const selectedDate = useUiStore((s) => s.selectedDate)
  const weekStart = useConfigStore((s) => s.weekStart)

  const isWeek = view === 'week'
  const isDay = view === 'day'
  const isList = view === 'list'

  let label: string
  if (isList) {
    label = '全部任务 · 按日期分组'
  } else if (isWeek) {
    const days = weekDates(selectedDate ?? todayStr(), weekStart)
    label = `${format(parseLocal(days[0]), 'M 月 d 日')} – ${format(parseLocal(days[6]), 'M 月 d 日')}`
  } else if (isDay) {
    label = format(parseLocal(selectedDate ?? todayStr()), 'yyyy 年 M 月 d 日')
  } else {
    label = format(new Date(currentYear, currentMonth, 1), 'yyyy 年 M 月')
  }

  const onPrev = isWeek ? prevWeek : isDay ? prevDay : prevMonth
  const onNext = isWeek ? nextWeek : isDay ? nextDay : nextMonth

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex h-11 shrink-0 items-center gap-3 border-b px-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2 className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
          时间轴
        </h2>

        <div className="view-tabs">
          <button className={!isWeek && !isDay && !isList ? 'active' : ''} onClick={() => setView('month')}>
            月
          </button>
          <button className={isWeek ? 'active' : ''} onClick={() => setView('week')}>
            周
          </button>
          <button className={isDay ? 'active' : ''} onClick={() => setView('day')}>
            日
          </button>
          <button className={isList ? 'active' : ''} onClick={() => setView('list')}>
            列表
          </button>
        </div>

        {!isList && (
          <div className="flex items-center gap-1">
            <button className="nav-btn" onClick={onPrev} aria-label="上一页">
              ‹
            </button>
            <span className="w-44 text-center text-sm font-semibold">{label}</span>
            <button className="nav-btn" onClick={onNext} aria-label="下一页">
              ›
            </button>
          </div>
        )}
        {isList && <span className="text-sm font-semibold">{label}</span>}

        <button className="text-btn" onClick={goToday}>
          今天
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'week' ? <WeekView /> : view === 'day' ? <DayView /> : view === 'list' ? <ListView /> : <MonthCalendar />}
      </div>
    </div>
  )
}
