/**
 * 日期工具：统一 YYYY-MM-DD（本地时区）解析/格式化。
 * 禁止使用 new Date('YYYY-MM-DD')（会按 UTC 解析导致跨时区偏移）。
 * 纯函数，主进程 / 渲染进程共用（date-fns 为运行时依赖）。
 */
import {
  addDays as fnsAddDays,
  addMonths,
  endOfMonth,
  format,
  getDay,
  parse,
  startOfMonth,
  startOfWeek,
  type Day,
} from 'date-fns'

export const DATE_FORMAT = 'yyyy-MM-dd'

/** 解析 YYYY-MM-DD 为本地时区 Date */
export function parseLocal(dateStr: string): Date {
  return parse(dateStr, DATE_FORMAT, new Date())
}

/** 格式化 Date 为 YYYY-MM-DD（本地时区） */
export function formatLocal(date: Date): string {
  return format(date, DATE_FORMAT)
}

export function todayStr(): string {
  return formatLocal(new Date())
}

export function addDays(dateStr: string, amount: number): string {
  return formatLocal(fnsAddDays(parseLocal(dateStr), amount))
}

export function startOfMonthStr(year: number, month: number): string {
  return formatLocal(startOfMonth(new Date(year, month, 1)))
}

export function endOfMonthStr(year: number, month: number): string {
  return formatLocal(endOfMonth(new Date(year, month, 1)))
}

/** 一个月内每一天的日期串（用于月视图网格构建） */
export function daysInMonth(year: number, month: number): string[] {
  const result: string[] = []
  const first = new Date(year, month, 1)
  const last = endOfMonth(first)
  for (let d = first; d <= last; d = fnsAddDays(d, 1)) {
    result.push(formatLocal(d))
  }
  return result
}

/** 某日期所在周的周一（weekStart=1）偏移索引，用于月历网格前置空白 */
export function leadingBlanks(year: number, month: number, weekStart: number): number {
  const day = getDay(new Date(year, month, 1)) // 0=周日…6=周六
  return (day - weekStart + 7) % 7
}

export function currentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = addMonths(new Date(year, month, 1), delta)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** 某日期所在周的起始日（weekStart：0=周日 1=周一） */
export function startOfWeekStr(dateStr: string, weekStart: number): string {
  return formatLocal(startOfWeek(parseLocal(dateStr), { weekStartsOn: weekStart as Day }))
}

/** 某日期所在周的连续 7 天（weekStart 决定起始日） */
export function weekDates(anchorDate: string, weekStart: number): string[] {
  const start = startOfWeek(parseLocal(anchorDate), { weekStartsOn: weekStart as Day })
  const result: string[] = []
  for (let i = 0; i < 7; i++) {
    result.push(formatLocal(fnsAddDays(start, i)))
  }
  return result
}
