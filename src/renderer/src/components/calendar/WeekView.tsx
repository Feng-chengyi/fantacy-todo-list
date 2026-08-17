/**
 * 周视图（时间轴）：7 列（按 weekStart 排列），仅展示各日已落库的专注记录。
 */
import { getDay } from 'date-fns'
import { parseLocal, todayStr, weekDates } from '../../../../shared/date'
import { useSessionsByDate } from '../../hooks/useSessionsByDate'
import { useTaskStore } from '../../stores/taskStore'
import { useConfigStore } from '../../stores/configStore'
import { useUiStore } from '../../stores/uiStore'
import { SessionPill } from './SessionViews'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function WeekColumn({ date, isToday }: { date: string; isToday: boolean }) {
  const byDate = useSessionsByDate()
  const tasks = useTaskStore((s) => s.tasks)
  const setSelectedDate = useUiStore((s) => s.setSelectedDate)

  const sessions = byDate.get(date) ?? []
  const d = parseLocal(date)
  const dayNumber = Number(date.slice(8, 10))

  return (
    <div
      className={`week-column ${isToday ? 'today' : ''}`}
      style={{ borderColor: 'var(--border)' }}
      onClick={() => setSelectedDate(date)}
    >
      <div className="week-column-head">
        <span className={`week-day-number ${isToday ? 'today-number' : ''}`}>
          {WEEKDAY_LABELS[getDay(d)]} {dayNumber}
        </span>
      </div>
      <div className="week-column-body">
        {sessions.map((s) => (
          <SessionPill key={s.id} session={s} tasks={tasks} />
        ))}
      </div>
    </div>
  )
}

export function WeekView() {
  const selectedDate = useUiStore((s) => s.selectedDate)
  const weekStart = useConfigStore((s) => s.weekStart)

  const today = todayStr()
  const dates = weekDates(selectedDate ?? today, weekStart)

  return (
    <div className="week-view">
      {dates.map((date) => (
        <WeekColumn key={date} date={date} isToday={date === today} />
      ))}
    </div>
  )
}
