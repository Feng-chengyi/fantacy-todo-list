/**
 * 统计看板纯函数（无 IO，可独立单测）。
 *
 * 统计口径：
 * - 今日 / 本周：实例级完成率（重复任务用 repeatEngine 按区间展开，skipped 与 abandoned 不计入分母）。
 * - 累计：任务级完成率（每个任务计 1 个，skipped/abandoned 不计入分母）。
 * - 连续打卡（streak）：从今天往前数，当天「至少有一个完成实例」的连续天数。
 * - 计数 / 优先级分布 / 分类分布：任务级（每个任务计 1 次）。
 */
import { formatLocal, parseLocal, todayStr, weekDates } from './date'
import { getOccurrenceStatus, isOccurrenceOnDate, listOccurrencesInRange } from './repeatEngine'
import type { Priority, RepeatOverride, Task } from './types'

export interface Completion {
  /** 分母（不含 skipped / abandoned） */
  total: number
  /** 已完成 */
  done: number
}

export interface TaskCounts {
  total: number
  done: number
  pending: number
  abandoned: number
}

export interface Stats {
  today: Completion
  week: Completion
  cumulative: Completion
  streak: number
  counts: TaskCounts
  /** 各优先级任务数 */
  priorityDistribution: Record<Priority, number>
  /** 各分类任务数（key 为分类名，不含空分类） */
  categoryDistribution: Record<string, number>
}

export interface ComputeStatsOptions {
  /** 基准日期 YYYY-MM-DD（默认今天，测试可注入） */
  today?: string
  /** 周起始日：0=周日 1=周一（默认周一） */
  weekStart?: number
}

/** 某日是否存在「至少一个完成实例」（非重复=当日 done 任务；重复=当日 done 实例） */
function hasDoneOnDate(date: string, tasks: Task[], overrides: RepeatOverride[]): boolean {
  for (const task of tasks) {
    if (task.date == null) continue
    if (task.repeat) {
      if (!isOccurrenceOnDate(date, task.repeat, task.date)) continue
      if (getOccurrenceStatus(task.id, date, overrides, task.status) === 'done') return true
    } else if (task.date === date && task.status === 'done') {
      return true
    }
  }
  return false
}

/** 区间内实例完成率（重复任务展开；skipped / abandoned 不计入） */
function completionInRange(
  from: string,
  to: string,
  tasks: Task[],
  overrides: RepeatOverride[],
): Completion {
  let total = 0
  let done = 0
  for (const task of tasks) {
    if (task.date == null) continue
    if (task.repeat) {
      const entries = listOccurrencesInRange(task.repeat, task.date, from, to, overrides, task.status, task.id)
      for (const entry of entries) {
        if (entry.status === 'skipped') continue
        total++
        if (entry.status === 'done') done++
      }
    } else if (task.date >= from && task.date <= to) {
      if (task.status === 'abandoned') continue
      total++
      if (task.status === 'done') done++
    }
  }
  return { total, done }
}

/** 计算全部统计指标 */
export function computeStats(
  tasks: Task[],
  overrides: RepeatOverride[],
  options: ComputeStatsOptions = {},
): Stats {
  const today = options.today ?? todayStr()
  const weekStart = options.weekStart ?? 1
  const week = weekDates(today, weekStart)
  const weekFrom = week[0]
  const weekTo = week[6]

  // 连续打卡：从今天往前，逐日判断是否「至少一个完成实例」
  let streak = 0
  const cursor = parseLocal(today)
  for (let i = 0; i < 366 * 5; i++) {
    const d = formatLocal(cursor)
    if (!hasDoneOnDate(d, tasks, overrides)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  // 任务级计数
  const counts: TaskCounts = {
    total: tasks.length,
    done: 0,
    pending: 0,
    abandoned: 0,
  }
  const priorityDistribution: Record<Priority, number> = { high: 0, medium: 0, low: 0 }
  const categoryDistribution: Record<string, number> = {}

  for (const task of tasks) {
    if (task.status === 'done') counts.done++
    else if (task.status === 'abandoned') counts.abandoned++
    else counts.pending++

    priorityDistribution[task.priority]++

    const category = task.category?.trim()
    if (category) categoryDistribution[category] = (categoryDistribution[category] ?? 0) + 1
  }

  // 累计完成率：任务级，分母 = pending + done（排除 abandoned）
  const cumulative = {
    total: counts.pending + counts.done,
    done: counts.done,
  }

  return {
    today: completionInRange(today, today, tasks, overrides),
    week: completionInRange(weekFrom, weekTo, tasks, overrides),
    cumulative,
    streak,
    counts,
    priorityDistribution,
    categoryDistribution,
  }
}
