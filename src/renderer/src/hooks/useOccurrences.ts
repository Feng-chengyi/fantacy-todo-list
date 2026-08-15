/**
 * 任务实例计算 hook：单日 / 整月，含重复任务展开与 override 覆盖。
 */
import { useMemo } from 'react'
import { PRIORITY_ORDER } from '../../../shared/defaults'
import { timeToMinutes } from '../../../shared/time'
import type { Occurrence, Priority, TaskStatus } from '../../../shared/types'
import { endOfMonthStr, startOfMonthStr } from '../../../shared/date'
import {
  getOccurrenceStatus,
  isOccurrenceOnDate,
  listOccurrencesInRange,
} from '../../../shared/repeatEngine'
import { useTaskStore } from '../stores/taskStore'

export type OccurrenceSort = 'priority' | 'time'

function rank(priority: Priority): number {
  return PRIORITY_ORDER[priority]
}

function byPriorityThenCreated(a: Occurrence, b: Occurrence): number {
  const diff = rank(a.task.priority) - rank(b.task.priority)
  if (diff !== 0) return diff
  return a.task.createdAt.localeCompare(b.task.createdAt)
}

/** 有时间段的在前并按开始时间升序，无时间段的按优先级/创建时间排后 */
function byTimeThenPriority(a: Occurrence, b: Occurrence): number {
  const aTime = a.task.startTime
  const bTime = b.task.startTime
  if (aTime && bTime) {
    const diff = timeToMinutes(aTime) - timeToMinutes(bTime)
    if (diff !== 0) return diff
    return byPriorityThenCreated(a, b)
  }
  if (aTime) return -1
  if (bTime) return 1
  return byPriorityThenCreated(a, b)
}

/** 某一天的所有任务实例（含重复展开），skipped 已过滤 */
export function useOccurrencesForDate(
  date: string,
  sort: OccurrenceSort = 'priority',
): Occurrence[] {
  const tasks = useTaskStore((s) => s.tasks)
  const overrides = useTaskStore((s) => s.overrides)

  return useMemo(() => {
    const result: Occurrence[] = []
    for (const task of tasks) {
      if (task.date == null) continue
      if (task.repeat) {
        if (isOccurrenceOnDate(date, task.repeat, task.date)) {
          const status = getOccurrenceStatus(task.id, date, overrides, task.status)
          if (status === 'skipped') continue
          result.push({ task, date, status })
        }
      } else if (task.date === date) {
        result.push({ task, date, status: task.status })
      }
    }
    result.sort(sort === 'time' ? byTimeThenPriority : byPriorityThenCreated)
    return result
  }, [tasks, overrides, date, sort])
}

/** 整个月按日期分组的实例映射 */
export function useOccurrencesForMonth(
  year: number,
  month: number,
): Record<string, Occurrence[]> {
  const tasks = useTaskStore((s) => s.tasks)
  const overrides = useTaskStore((s) => s.overrides)

  return useMemo(() => {
    const from = startOfMonthStr(year, month)
    const to = endOfMonthStr(year, month)
    const map: Record<string, Occurrence[]> = {}

    for (const task of tasks) {
      if (task.date == null) continue
      if (task.repeat) {
        const entries = listOccurrencesInRange(task.repeat, task.date, from, to, overrides, task.status, task.id)
        for (const entry of entries) {
          if (entry.status === 'skipped') continue
          const list = (map[entry.date] ??= [])
          list.push({ task, date: entry.date, status: entry.status as TaskStatus })
        }
      } else if (task.date >= from && task.date <= to) {
        const list = (map[task.date] ??= [])
        list.push({ task, date: task.date, status: task.status })
      }
    }

    for (const key of Object.keys(map)) map[key].sort(byPriorityThenCreated)
    return map
  }, [tasks, overrides, year, month])
}
