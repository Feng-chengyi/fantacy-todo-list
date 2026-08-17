/**
 * 单日格（时间轴月视图）：今日高亮、当日专注记录胶囊、当日汇总分钟数。
 * 只展示已落库的专注会话，不展示任何任务占位。
 */
import { todayStr } from '../../../../shared/date'
import { useSessionsByDate } from '../../hooks/useSessionsByDate'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { SessionPill } from './SessionViews'

const MAX_VISIBLE = 3

export function DayCell({ date }: { date: string }) {
  const byDate = useSessionsByDate()
  const tasks = useTaskStore((s) => s.tasks)
  const selectedDate = useUiStore((s) => s.selectedDate)
  const setSelectedDate = useUiStore((s) => s.setSelectedDate)

  const today = todayStr()
  const isToday = date === today
  const isSelected = date === selectedDate
  const dayNumber = Number(date.slice(8, 10))

  const sessions = byDate.get(date) ?? []
  const totalMin = Math.round(sessions.reduce((acc, s) => acc + s.durationSec, 0) / 60)
  const visible = sessions.slice(0, MAX_VISIBLE)
  const extra = sessions.length - MAX_VISIBLE

  return (
    <div
      className={`day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
      style={{ borderColor: 'var(--border)' }}
      onClick={() => setSelectedDate(date)}
      title={totalMin > 0 ? `当日专注 ${totalMin} 分钟` : undefined}
    >
      <div className="flex items-center justify-between px-1.5 pt-1">
        <span className={`day-number ${isToday ? 'today-number' : ''}`}>{dayNumber}</span>
        {totalMin > 0 && <span className="day-total">{totalMin} 分</span>}
      </div>

      <div className="mt-1 flex flex-col gap-1 overflow-hidden px-1">
        {visible.map((s) => (
          <SessionPill key={s.id} session={s} tasks={tasks} />
        ))}
        {extra > 0 && (
          <div className="px-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            +{extra} 条
          </div>
        )}
      </div>
    </div>
  )
}
