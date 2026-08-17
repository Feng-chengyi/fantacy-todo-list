/**
 * v3.1 任务仓库行（待办页/待办集页共用）：勾选完成｜标题｜类型标签｜计时操作；
 * 二级元数据（分类/提醒/进度/连续打卡）默认收起，hover/focus 展开（N1.3）；
 * 过期任务红色脉动高亮（N4）；已完成显示完成时间戳；目标进度环跟随任务自定义色（F6）。
 * 计时启动后由悬浮窗接管走时；完成自动停止计时（时长保留）。
 */
import { useRef, type MouseEvent } from 'react'
import type { Task } from '../../../../shared/types'
import { taskColor } from '../../../../shared/defaults'
import { isSameTimerInstance } from '../../../../shared/focus'
import { TASK_TYPE_LABELS } from '../../../../shared/listView'
import { daysUntil } from '../../../../shared/countdown'
import { formatDurationMinutes } from '../../../../shared/time'
import { todayStr } from '../../../../shared/date'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { commitFocus, switchTimer } from '../../services/focus'
import { Stopwatch } from '../task/Stopwatch'

/** 进度信息：习惯展示连续打卡；目标展示截止倒计时；普通展示累计专注 */
function progressLabel(task: Task, todaySec: number, today: string): string {
  const parts: string[] = []
  const type = task.taskType ?? 'normal'
  if (type === 'goal') {
    if (task.date) {
      const left = daysUntil(task.date, today)
      if (left > 0) parts.push(`距截止 ${left} 天`)
      else if (left === 0) parts.push('今天截止')
      else parts.push('已过截止日')
    }
    if (task.durationSec != null && task.durationSec > 0) {
      parts.push(`累计 ${formatDurationMinutes(task.durationSec)}`)
    }
  } else if (task.repeat) {
    if (todaySec > 0) parts.push(`今日 ${formatDurationMinutes(todaySec)}`)
  } else if (task.durationSec != null && task.durationSec > 0) {
    parts.push(`累计 ${formatDurationMinutes(task.durationSec)}`)
  }
  return parts.join(' · ')
}

/** 习惯连续打卡天数（含今天） */
function habitStreak(task: Task, today: string): number {
  const set = new Set(task.habitCheckins ?? [])
  if (set.size === 0) return 0
  let streak = 0
  const d = new Date(`${today}T00:00:00`)
  // 今天未打卡时从昨天起算（打断不向前虚增）
  if (!set.has(today)) d.setDate(d.getDate() - 1)
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!set.has(key)) break
    streak += 1
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** ISO 时刻 → 本地 HH:mm（完成时间戳展示） */
function localHm(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TaskRepoRow({ task, todaySec }: { task: Task; todaySec: number }) {
  const openEdit = useUiStore((s) => s.openEdit)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const timer = useUiStore((s) => s.timer)
  const setStatus = useTaskStore((s) => s.setStatus)
  const updateTask = useTaskStore((s) => s.updateTask)

  const today = todayStr()
  const type = task.taskType ?? 'normal'
  const done = task.status === 'done'
  const abandoned = task.status === 'abandoned'
  // 过期判定：未完成 + 有截止日 + 已过今天（N4 红色脉动高亮）
  const overdueDays = !done && !abandoned && task.date ? -daysUntil(task.date, today) : 0
  const overdue = overdueDays > 0
  // 计时实例口径：周期/习惯任务任务级（null），非周期用其日期
  const occurrenceDate = task.repeat ? null : (task.date ?? null)
  const isTiming = !!timer && isSameTimerInstance(timer, task.id, occurrenceDate)
  const progress = progressLabel(task, todaySec, today)
  const checkedToday = (task.habitCheckins ?? []).includes(today)
  const color = taskColor(task)

  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ task, x: e.clientX, y: e.clientY })
  }

  // 高频操作防抖（PRD 边界 4）：同一动作 400ms 内的重复点击忽略，防双击翻转状态
  const lastActionRef = useRef<{ key: string; at: number } | null>(null)
  const debounced = (key: string, fn: () => void): void => {
    const now = Date.now()
    if (lastActionRef.current && lastActionRef.current.key === key && now - lastActionRef.current.at < 400) return
    lastActionRef.current = { key, at: now }
    fn()
  }

  /** 勾选完成 / 撤销完成；完成时自动停止计时（已产生时长保留） */
  const toggleDone = (): void => {
    if (type === 'habit') return
    debounced(`done:${task.id}`, () => {
      if (!done && timer && isTiming) void commitFocus()
      void setStatus(task.id, done ? 'pending' : 'done')
    })
  }

  /** 习惯打卡 / 撤销今日打卡 */
  const toggleCheckin = (): void => {
    debounced(`checkin:${task.id}`, () => {
      const checkins = task.habitCheckins ?? []
      const next = checkedToday ? checkins.filter((d) => d !== today) : [...checkins, today]
      void updateTask(task.id, { habitCheckins: next })
    })
  }

  const canTime = type !== 'goal' && (task.timerKind ?? 'stopwatch') !== 'none' && !done && !abandoned

  return (
    <div
      className={`task-card roomy repo-row ${done ? 'done' : ''} ${abandoned ? 'abandoned' : ''} ${overdue ? 'overdue' : ''}`}
      onClick={() => openEdit(task)}
      onContextMenu={onContextMenu}
      title={task.title}
    >
      <div className="task-card-row">
        <span className="task-priority-bar" style={{ background: color }} />
        {type === 'habit' ? (
          <button
            className={`check ${checkedToday ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              toggleCheckin()
            }}
            title={checkedToday ? '撤销今日打卡' : '今日打卡'}
          >
            {checkedToday ? '✓' : ''}
          </button>
        ) : (
          <button
            className={`check ${done ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              toggleDone()
            }}
            title={done ? '撤销完成' : '完成'}
          >
            {done ? '✓' : ''}
          </button>
        )}
        <span className="task-title">{task.title}</span>
        {overdue && (
          <span className="repo-overdue" title={`截止日 ${task.date}`}>
            <i className="repo-overdue-dot" />
            过期 {overdueDays} 天
          </span>
        )}
        {done && task.completedAt && <span className="repo-done-at">✅ {localHm(task.completedAt)}</span>}
        {type === 'goal' && (
          <span
            className="goal-ring"
            style={{ ['--p' as string]: String(task.progressValue ?? 0), ['--ring-color' as string]: color }}
          >
            <span>{Math.round(task.progressValue ?? 0)}</span>
          </span>
        )}
        <span className={`type-tag ${type !== 'normal' ? 'habit' : ''}`}>{TASK_TYPE_LABELS[type]}</span>
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
          canTime && (
            <button
              className="mini-btn timer-btn"
              onClick={(e) => {
                e.stopPropagation()
                // 先提交旧计时再开新计时（不丢上一任务时长），走时由悬浮窗接管
                void switchTimer(task.id, occurrenceDate)
              }}
              title={(task.timerKind ?? 'stopwatch') === 'countdown' ? '开始倒计时' : '开始计时'}
            >
              {(task.timerKind ?? 'stopwatch') === 'countdown' ? '⏳ 倒计时' : '▶ 开始计时'}
            </button>
          )
        )}
      </div>
      {/* 二级元数据：默认收起，hover / focus 展开（N1.3） */}
      {(task.category?.trim() || task.reminder?.time || progress || (type === 'habit' && habitStreak(task, today) > 0)) && (
        <div className="repo-row-extra">
          {task.category?.trim() && (
            <span className="task-category">
              <span className="task-category-dot" style={{ background: color }} />
              {task.category.trim()}
            </span>
          )}
          {task.reminder?.time && <span className="repo-reminder">⏰ {task.reminder.time}</span>}
          {type === 'habit' && habitStreak(task, today) > 0 && (
            <span className="repo-progress">🔥 连续 {habitStreak(task, today)} 天</span>
          )}
          {progress && <span className="repo-progress">{progress}</span>}
        </div>
      )}
    </div>
  )
}
