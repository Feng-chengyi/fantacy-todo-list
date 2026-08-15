/**
 * 时间冲突检测（纯函数，可独立单测）。
 * 规则：同一天（date 相同）且都填写了 startTime/endTime 的任务，
 * 两两判断 [start,end) 半开区间是否重叠，返回冲突对列表。
 */
import type { Task } from './types'
import { timeToMinutes } from './time'

/** 参与冲突检测的最小字段集 */
export type TimedTask = Pick<Task, 'id' | 'date' | 'startTime' | 'endTime'>

export interface ConflictPair {
  a: Task
  b: Task
}

/** 任务是否具备完整时间区间 */
export function hasTimeRange(task: Pick<Task, 'startTime' | 'endTime'>): boolean {
  return !!task.startTime && !!task.endTime
}

/** 两个任务是否时间重叠（同一天 + 半开区间相交） */
export function hasOverlap(a: TimedTask, b: TimedTask): boolean {
  if (a.id === b.id) return false
  if (a.date == null || b.date == null || a.date !== b.date) return false
  if (!hasTimeRange(a) || !hasTimeRange(b)) return false
  const aStart = timeToMinutes(a.startTime as string)
  const aEnd = timeToMinutes(a.endTime as string)
  const bStart = timeToMinutes(b.startTime as string)
  const bEnd = timeToMinutes(b.endTime as string)
  return aStart < bEnd && bStart < aEnd
}

/** 检测任务列表中所有冲突对（两两比较） */
export function detectConflicts(tasks: Task[]): ConflictPair[] {
  const result: ConflictPair[] = []
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i]
      const b = tasks[j]
      if (hasOverlap(a, b)) result.push({ a, b })
    }
  }
  return result
}

/** 返回与指定任务冲突的任务列表（不含自身） */
export function conflictsForTask(tasks: Task[], taskId: string): Task[] {
  const self = tasks.find((t) => t.id === taskId)
  if (!self) return []
  return tasks.filter((t) => t.id !== taskId && hasOverlap(self, t))
}
