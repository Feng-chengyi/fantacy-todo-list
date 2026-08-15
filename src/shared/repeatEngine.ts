/**
 * 重复任务引擎（纯函数，无 IO，可独立单测）。
 *
 * 支持类型：daily / weekly / monthly / yearly / custom（custom 等价「每隔 N 天」）。
 * 边界约束：不向前回溯（D < anchor 不命中）、endDate、endCount。
 * 覆盖：RepeatOverride(done/skipped) 决定某实例最终状态。
 */
import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  getDate,
  getDay,
  getDaysInMonth,
  getMonth,
} from 'date-fns'
import { parseLocal, formatLocal } from './date'
import type { OverrideAction, RepeatOverride, RepeatRule, TaskStatus } from './types'

/** 某实例最终状态 */
export type OccurrenceStatus = TaskStatus | 'skipped'

/** 区间展开的最小单元（不含 task，避免纯函数依赖实体） */
export interface OccurrenceEntry {
  date: string
  status: OccurrenceStatus
}

/** 日期所在周的周一（weekStart 默认周一） */
function weekStart(date: Date, weekStartsOn = 1): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = (getDay(d) - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return d
}

/** 规整间隔数（>=1 的整数） */
function normalizeInterval(rule: RepeatRule): number {
  const n = Math.floor(Number(rule.interval))
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/**
 * 纯模式匹配（不含 endDate/endCount 边界，也不含 anchor 前的回溯判断）。
 * 供 isOccurrenceOnDate 与 nthOccurrence 复用，避免递归。
 */
function matchesPattern(date: Date, rule: RepeatRule, anchor: Date): boolean {
  const interval = normalizeInterval(rule)
  if (date < anchor) return false

  switch (rule.type) {
    case 'daily':
    case 'custom':
      return differenceInCalendarDays(date, anchor) % interval === 0

    case 'weekly': {
      const weekdays =
        rule.weekdays && rule.weekdays.length > 0 ? rule.weekdays : [getDay(anchor)]
      if (!weekdays.includes(getDay(date))) return false
      const weeks = differenceInCalendarDays(weekStart(date), weekStart(anchor)) / 7
      return weeks % interval === 0
    }

    case 'monthly': {
      const monthDay = rule.monthDay ?? getDate(anchor)
      // 短月钳制：目标日 > 当月天数时钳到当月最后一天
      const targetDay = Math.min(monthDay, getDaysInMonth(date))
      if (getDate(date) !== targetDay) return false
      const months = differenceInCalendarMonths(date, anchor)
      return months % interval === 0
    }

    case 'yearly': {
      const month = rule.yearMonth ?? getMonth(anchor) + 1 // getMonth 0-based → 1-based
      const day = rule.yearDay ?? getDate(anchor)
      if (getMonth(date) + 1 !== month) return false
      // 2/29 非闰年钳制到 2/28
      const targetDay = Math.min(day, getDaysInMonth(date))
      if (getDate(date) !== targetDay) return false
      const years = differenceInCalendarYears(date, anchor)
      return years % interval === 0
    }

    default:
      return false
  }
}

/**
 * 判断某日是否命中（含边界约束，不含覆盖）。
 */
export function isOccurrenceOnDate(date: string, rule: RepeatRule, anchorDate: string): boolean {
  const d = parseLocal(date)
  const anchor = parseLocal(anchorDate)

  if (d < anchor) return false
  if (rule.endDate && date > rule.endDate) return false
  if (rule.endCount != null) {
    const last = nthOccurrence(rule, anchorDate, rule.endCount)
    if (last && date > last) return false
  }
  return matchesPattern(d, rule, anchor)
}

/**
 * 计算第 n 次（1-based）发生的日期，超出可枚举范围返回 null。
 * 基于 matchesPattern 枚举，不与 isOccurrenceOnDate 互相递归。
 */
export function nthOccurrence(rule: RepeatRule, anchorDate: string, n: number): string | null {
  if (!Number.isFinite(n) || n < 1) return null
  const anchor = parseLocal(anchorDate)
  let cursor = new Date(anchor)
  let count = 0
  const MAX_ITER = 200000
  for (let i = 0; i < MAX_ITER; i++) {
    if (matchesPattern(cursor, rule, anchor)) {
      count++
      if (count === n) return formatLocal(cursor)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return null
}

/**
 * 获取某重复实例的最终状态（覆盖优先）。
 */
export function getOccurrenceStatus(
  taskId: string,
  date: string,
  overrides: RepeatOverride[],
  baseStatus: TaskStatus,
): OccurrenceStatus {
  const ov = overrides.find((o) => o.taskId === taskId && o.occurrenceDate === date)
  if (!ov) return baseStatus
  return ov.action === 'done' ? 'done' : 'skipped'
}

/**
 * 展开 [from, to] 区间内的所有实例（月视图一次调用）。
 */
export function listOccurrencesInRange(
  rule: RepeatRule,
  anchorDate: string,
  from: string,
  to: string,
  overrides: RepeatOverride[],
  baseStatus: TaskStatus,
  taskId?: string,
): OccurrenceEntry[] {
  const result: OccurrenceEntry[] = []
  const start = parseLocal(from)
  const end = parseLocal(to)
  const cursor = new Date(start)
  const MAX_DAYS = 400
  for (let i = 0; i < MAX_DAYS && cursor <= end; i++) {
    const dateStr = formatLocal(cursor)
    if (isOccurrenceOnDate(dateStr, rule, anchorDate)) {
      const status = taskId
        ? getOccurrenceStatus(taskId, dateStr, overrides, baseStatus)
        : baseStatus
      result.push({ date: dateStr, status })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

export type { RepeatRule, RepeatOverride, OverrideAction }
