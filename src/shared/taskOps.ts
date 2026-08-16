/**
 * 任务状态流转纯函数（主进程 taskSetStatus 与单测共用）。
 * 语义：completedAt 仅在 status === 'done' 时有意义，回到 pending / abandoned 时清空，
 * 保证「完成时间 = 最后一次完成」口径一致，不残留旧值。
 */
import { differenceInCalendarDays } from 'date-fns'
import { formatLocal, parseLocal } from './date'
import type { Task, TaskStatus } from './types'

export function applyTaskStatus(task: Task, status: TaskStatus, nowIso: string): Task {
  return {
    ...task,
    status,
    completedAt: status === 'done' ? nowIso : null,
    updatedAt: nowIso,
  }
}

/**
 * 拖拽改期时同步平移重复任务的 endDate（拖动 = 整个系列平移）。
 *
 * Bug 场景（重复任务拖出范围后整体消失）：daily 任务 anchor=8/16、endDate=8/23，
 * 拖到 8/24 时只改 date 不改 endDate → anchor > endDate，repeatEngine 对任何日期
 * 都不命中，整个系列从日历消失（新位置也显示不出来）；计时下拉只看 pending 仍显示，
 * 造成「日历没了、计时还有」的数据不一致。endDate 随 anchor 平移同样天数即可保持
 * 系列长度不变。endCount（按次数结束）与 anchor 无关，无需处理。
 */
export function shiftRepeatOnMove(task: Task, targetDate: string): Task {
  const rule = task.repeat
  if (!rule?.endDate || !task.date || task.date === targetDate) return task
  const delta = differenceInCalendarDays(parseLocal(targetDate), parseLocal(task.date))
  if (delta === 0) return task
  const end = parseLocal(rule.endDate)
  end.setDate(end.getDate() + delta)
  return { ...task, repeat: { ...rule, endDate: formatLocal(end) } }
}
