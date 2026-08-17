/**
 * 时间轴专注记录展示组件：
 * - SessionPill：月/周视图紧凑胶囊（任务色条 + 标题 + 分钟数）
 * - SessionRow：日/列表视图宽行（标题 + 起止时间段 + 时长）
 * 绑定任务可能已删除 → 回退「已删除任务」；自由会话按来源显示「番茄专注/自由计时」。
 */
import type { FocusSession, Task } from '../../../../shared/types'
import { taskColor } from '../../../../shared/defaults'
import { formatDurationMinutes } from '../../../../shared/time'
import { sessionRangeLabel } from '../../../../shared/sessionView'

/** 会话展示信息：标题 + 颜色 */
export function sessionDisplay(
  session: FocusSession,
  tasks: Task[],
): { title: string; color: string } {
  const task = tasks.find((t) => t.id === session.taskId)
  if (task) return { title: task.title, color: taskColor(task) }
  if (!session.taskId) {
    return {
      title: session.id.startsWith('pomodoro-') ? '番茄专注' : '自由计时',
      color: 'var(--accent)',
    }
  }
  return { title: '已删除任务', color: 'var(--text-muted)' }
}

/** 分钟整数（月/周格子弹丸用，四舍五入） */
function minutesLabel(totalSeconds: number): string {
  return `${Math.max(0, Math.round(totalSeconds / 60))} 分`
}

export function SessionPill({ session, tasks }: { session: FocusSession; tasks: Task[] }) {
  const { title, color } = sessionDisplay(session, tasks)
  return (
    <div
      className="session-pill"
      title={`${title} · ${formatDurationMinutes(session.durationSec)}`}
    >
      <span className="session-pill-bar" style={{ background: color }} />
      <span className="session-pill-title">{title}</span>
      <span className="session-pill-duration">{minutesLabel(session.durationSec)}</span>
    </div>
  )
}

export function SessionRow({ session, tasks }: { session: FocusSession; tasks: Task[] }) {
  const { title, color } = sessionDisplay(session, tasks)
  return (
    <div className="task-card roomy session-row" title={title}>
      <div className="task-card-row">
        <span className="task-priority-bar" style={{ background: color }} />
        <span className="task-title">{title}</span>
        <span className="task-time">{sessionRangeLabel(session)}</span>
        <span className="duration-mark">{formatDurationMinutes(session.durationSec)}</span>
      </div>
    </div>
  )
}
