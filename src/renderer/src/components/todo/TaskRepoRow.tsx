/**
 * 任务仓库行（待办首页桌面行列表）：名称｜类型标签｜提醒时间｜进度信息｜计时操作。
 * 无勾选框（计时会话即完成记录）；hover 高亮；右键唤出任务菜单；点击打开编辑。
 */
import type { MouseEvent } from 'react'
import type { Task } from '../../../../shared/types'
import { taskColor } from '../../../../shared/defaults'
import { isSameTimerInstance } from '../../../../shared/focus'
import { formatDurationMinutes } from '../../../../shared/time'
import { todayStr } from '../../../../shared/date'
import { useUiStore } from '../../stores/uiStore'
import { commitFocus, switchTimer } from '../../services/focus'
import { Stopwatch } from '../task/Stopwatch'

/** 周期任务截止日期剩余天数（正 = 未来，0 = 当天，负 = 已过） */
export function daysUntil(date: string, today: string): number {
  const a = new Date(`${date}T00:00:00`).getTime()
  const b = new Date(`${today}T00:00:00`).getTime()
  return Math.round((a - b) / 86400000)
}

/** 进度信息：周期任务展示今日专注 + 截止倒计时；普通任务展示累计专注 */
function progressLabel(task: Task, todaySec: number, today: string): string {
  const parts: string[] = []
  if (task.repeat) {
    if (todaySec > 0) parts.push(`今日 ${formatDurationMinutes(todaySec)}`)
    if (task.repeat.endDate) {
      const left = daysUntil(task.repeat.endDate, today)
      if (left > 0) parts.push(`距截止 ${left} 天`)
      else if (left === 0) parts.push('今天截止')
      else parts.push('已到截止日')
    }
  } else if (task.durationSec != null && task.durationSec > 0) {
    parts.push(`累计 ${formatDurationMinutes(task.durationSec)}`)
  }
  return parts.join(' · ')
}

export function TaskRepoRow({ task, todaySec }: { task: Task; todaySec: number }) {
  const openEdit = useUiStore((s) => s.openEdit)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const openTimerPanel = useUiStore((s) => s.openTimerPanel)
  const timer = useUiStore((s) => s.timer)

  const today = todayStr()
  const done = task.status === 'done'
  const abandoned = task.status === 'abandoned'
  // 计时实例口径与计时面板一致：周期任务任务级（null），非周期任务用其日期
  const occurrenceDate = task.repeat ? null : (task.date ?? null)
  const isTiming = !!timer && isSameTimerInstance(timer, task.id, occurrenceDate)
  const progress = progressLabel(task, todaySec, today)

  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ task, x: e.clientX, y: e.clientY })
  }

  return (
    <div
      className={`task-card roomy repo-row ${done ? 'done' : ''} ${abandoned ? 'abandoned' : ''}`}
      onClick={() => openEdit(task)}
      onContextMenu={onContextMenu}
      title={task.title}
    >
      <div className="task-card-row">
        <span className="task-priority-bar" style={{ background: taskColor(task) }} />
        <span className="task-title">{task.title}</span>
        <span className={`type-tag ${task.repeat ? 'habit' : 'normal'}`}>
          {task.repeat ? '习惯' : '普通'}
        </span>
        {task.category?.trim() && (
          <span className="task-category">
            <span className="task-category-dot" style={{ background: taskColor(task) }} />
            {task.category.trim()}
          </span>
        )}
        {task.reminder?.time && <span className="repo-reminder">⏰ {task.reminder.time}</span>}
        {progress && <span className="repo-progress">{progress}</span>}
        {isTiming ? (
          <>
            <Stopwatch taskId={task.id} occurrenceDate={occurrenceDate} />
            <button
              className="mini-btn timer-btn"
              onClick={(e) => {
                e.stopPropagation()
                void commitFocus()
              }}
              title="停止计时"
            >
              ⏹ 停止
            </button>
          </>
        ) : (
          !done &&
          !abandoned && (
            <button
              className="mini-btn timer-btn"
              onClick={(e) => {
                e.stopPropagation()
                // 先提交旧计时再开新计时（不丢上一任务时长），并定向到计时面板
                void switchTimer(task.id, occurrenceDate)
                openTimerPanel()
              }}
              title="开始计时"
            >
              ▶ 开始计时
            </button>
          )
        )}
      </div>
    </div>
  )
}
