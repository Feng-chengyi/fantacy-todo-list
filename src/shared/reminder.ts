/**
 * 任务提醒纯函数：按天 HH:mm 触发（主进程轮询 + 进程内去重）。
 * 复用 shared/date.ts（日期解析）与 repeatEngine.ts（重复实例展开），
 * 保证主进程与单测口径一致；无 IO / 无 electron 依赖。
 */
import { formatLocal, parseLocal } from './date'
import { getOccurrenceStatus, isOccurrenceOnDate } from './repeatEngine'
import type { FullData, Task } from './types'

/** 提醒轮询间隔（30 秒） */
export const REMINDER_POLL_MS = 30_000
/** 提醒回溯窗口（1 小时）：应用晚启动 / 休眠期间错过的提醒在此窗口内补触发 */
export const REMINDER_LOOKBACK_MS = 60 * 60 * 1000

/** 一次待触发的提醒实例（已展开到具体日期 + 时间点） */
export interface ReminderInstance {
  /** 去重键（taskId@日期），主进程据此进程内去重 */
  key: string
  taskId: string
  title: string
  /** 实例日期 YYYY-MM-DD */
  date: string
  /** 提醒时间 HH:mm */
  time: string
  /** 提醒触发毫秒时间戳 */
  atMs: number
}

/** 去重键：同一任务同一日期只提醒一次 */
export function reminderKey(taskId: string, date: string): string {
  return `${taskId}@${date}`
}

/** 解析 HH:mm 为分钟数；非法返回 null（区别于 timeToMinutes 的 0 回退，提醒需严格） */
function parseReminderMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time).trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/**
 * 计算任务在某日期上的提醒触发时间戳（毫秒）。
 * 无提醒 / 时间非法返回 null。
 */
export function resolveReminderAt(task: Task, date: string): number | null {
  const reminder = task.reminder
  if (!reminder) return null
  const minutes = parseReminderMinutes(reminder.time)
  if (minutes == null) return null
  const d = parseLocal(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime() + minutes * 60 * 1000
}

/**
 * 列出「今天」的全部待提醒实例（pending 且今天为实例日），未按时间过滤。
 * 重复任务展开今日实例并过滤 done/skipped 覆盖；收集箱（date=null）不计入。
 */
export function listTodayReminders(data: FullData, today: string): ReminderInstance[] {
  const result: ReminderInstance[] = []
  for (const task of data.tasks) {
    if (!task.reminder) continue
    if (task.date == null) continue
    if (task.status !== 'pending') continue

    let isToday = false
    if (task.repeat) {
      if (isOccurrenceOnDate(today, task.repeat, task.date)) {
        const status = getOccurrenceStatus(task.id, today, data.overrides, task.status)
        isToday = status === 'pending'
      }
    } else {
      isToday = task.date === today
    }
    if (!isToday) continue

    const atMs = resolveReminderAt(task, today)
    if (atMs == null) continue
    result.push({
      key: reminderKey(task.id, today),
      taskId: task.id,
      title: task.title,
      date: today,
      time: task.reminder.time,
      atMs,
    })
  }
  return result
}

/**
 * 列出「已到点且未超过回溯窗口」的待提醒实例（去重交由调用方）。
 * 语义：atMs ∈ (now - REMINDER_LOOKBACK_MS, now]；未来未到点的提醒不返回。
 */
export function listDueReminders(data: FullData, now: number = Date.now()): ReminderInstance[] {
  const today = formatLocal(new Date(now))
  return listTodayReminders(data, today).filter(
    (r) => r.atMs <= now && now - r.atMs <= REMINDER_LOOKBACK_MS,
  )
}
