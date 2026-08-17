/**
 * 日视图（时间轴）：单日专注记录按时间升序，仅展示已落库会话。
 */
import { getDay } from 'date-fns'
import { parseLocal, todayStr } from '../../../../shared/date'
import { useSessionsByDate } from '../../hooks/useSessionsByDate'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { SessionRow } from './SessionViews'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function DayView() {
  const selectedDate = useUiStore((s) => s.selectedDate)
  const byDate = useSessionsByDate()
  const tasks = useTaskStore((s) => s.tasks)

  const date = selectedDate ?? todayStr()
  const sessions = byDate.get(date) ?? []
  const isToday = date === todayStr()

  return (
    <div className={`day-view ${isToday ? 'today' : ''}`}>
      <div className="day-view-head">
        <span className="day-view-title">
          {date} 星期{WEEKDAY_LABELS[getDay(parseLocal(date))]}
        </span>
      </div>
      <div className="day-view-body">
        {sessions.length === 0 ? (
          <div className="day-view-empty">这一天暂无专注记录，计时结束后会自动生成</div>
        ) : (
          sessions.map((s) => <SessionRow key={s.id} session={s} tasks={tasks} />)
        )}
      </div>
    </div>
  )
}
