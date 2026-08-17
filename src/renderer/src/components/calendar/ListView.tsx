/**
 * 列表视图（时间轴）：全部专注记录按日期分组（最近在前），仅展示已落库会话。
 */
import { listDateLabel } from '../../../../shared/listView'
import { summarizeDay } from '../../../../shared/sessionView'
import { formatDurationCompact } from '../../../../shared/time'
import { todayStr } from '../../../../shared/date'
import { useSessionsByDate } from '../../hooks/useSessionsByDate'
import { useTaskStore } from '../../stores/taskStore'
import { SessionRow } from './SessionViews'

export function ListView() {
  const byDate = useSessionsByDate()
  const tasks = useTaskStore((s) => s.tasks)
  const sessionsAll = useTaskStore((s) => s.sessions)

  const today = todayStr()
  // 日期降序：最近的记录在最前
  const dates = [...byDate.keys()].sort().reverse()

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <h2 className="mb-3 text-base font-bold">专注记录</h2>
      {dates.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          暂无专注记录，计时结束后会自动生成
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {dates.map((date) => {
            const sessions = byDate.get(date) ?? []
            const summary = summarizeDay(sessionsAll, date)
            return (
              <section key={date}>
                <div className={`list-group-head ${date === today ? 'today' : ''}`}>
                  <span className="list-group-label">{listDateLabel(date)}</span>
                  <span className="list-group-count">
                    {summary.count} 次 · {formatDurationCompact(summary.totalSec)}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {sessions.map((s) => (
                    <SessionRow key={s.id} session={s} tasks={tasks} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
