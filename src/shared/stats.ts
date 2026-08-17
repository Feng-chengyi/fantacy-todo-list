/**
 * 统计看板纯函数（无 IO，可独立单测）。
 *
 * 统计口径：
 * - 今日 / 本周：实例级完成率（重复任务用 repeatEngine 按区间展开，skipped 与 abandoned 不计入分母）。
 * - 累计：任务级完成率（每个任务计 1 个，skipped/abandoned 不计入分母）。
 * - 连续打卡（streak）：从今天往前数，当天「至少有一个完成实例」的连续天数。
 * - 计数 / 优先级分布 / 分类分布：任务级（每个任务计 1 次）。
 */
import { daysInMonth, formatLocal, parseLocal, todayStr, weekDates } from './date'
import { getOccurrenceStatus, isOccurrenceOnDate, listOccurrencesInRange } from './repeatEngine'
import type { FocusSession, Priority, RepeatOverride, Task } from './types'

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

/* ============ 专注（正向计时）统计 ============ */

/** 专注统计汇总（区间内） */
export interface FocusSummary {
  /** 区间内会话总数 */
  totalSessions: number
  /** 区间内总时长（秒） */
  totalSeconds: number
  /** 日均时长（秒）：区间天数含首尾 */
  avgSecondsPerDay: number
  /** 当日（today）会话数 */
  todaySessions: number
  /** 当日（today）总时长（秒） */
  todaySeconds: number
}

export interface FocusSummaryOptions {
  /** 统计起始日期 YYYY-MM-DD（默认 = 会话最早日期；无会话则 today） */
  from?: string
  /** 统计结束日期 YYYY-MM-DD（默认 today） */
  to?: string
  /** 基准日期（默认今天，测试可注入） */
  today?: string
}

/**
 * 会话归属的本地日期（YYYY-MM-DD）。
 * startedAt 为 ISO（UTC）字符串：必须先 new Date 转「本地时刻」再取本地日期，
 * 直接 slice(0,10) 取到的是 UTC 日期，UTC+8 凌晨 00:00–08:00 的会话会被错归到昨天（QA Bug 2）。
 */
function sessionDate(s: FocusSession): string {
  return formatLocal(new Date(s.startedAt))
}

/** 两个 YYYY-MM-DD 之间（含首尾）的天数 */
function daysBetweenInclusive(from: string, to: string): number {
  const ms = parseLocal(to).getTime() - parseLocal(from).getTime()
  return Math.floor(ms / 86400000) + 1
}

/** 计算专注统计汇总（区间 [from, to]，today 指标不受 from 限制仍按当日统计口径） */
export function computeFocusSummary(
  sessions: FocusSession[],
  options: FocusSummaryOptions = {},
): FocusSummary {
  const today = options.today ?? todayStr()
  const to = options.to ?? today

  // 归属日列表（一次遍历）
  const dates = sessions.map(sessionDate)

  let from = options.from
  if (!from) {
    from = dates.length > 0 ? dates.reduce((min, d) => (d < min ? d : min), dates[0]) : today
  }

  let totalSessions = 0
  let totalSeconds = 0
  let todaySessions = 0
  let todaySeconds = 0
  for (let i = 0; i < sessions.length; i++) {
    const d = dates[i]
    if (d < from || d > to) continue
    totalSessions++
    totalSeconds += sessions[i].durationSec
    if (d === today) {
      todaySessions++
      todaySeconds += sessions[i].durationSec
    }
  }

  const days = Math.max(1, daysBetweenInclusive(from < today ? from : today, to < today ? to : today))
  return {
    totalSessions,
    totalSeconds,
    avgSecondsPerDay: Math.round(totalSeconds / days),
    todaySessions,
    todaySeconds,
  }
}

/** 专注分布粒度 */
export type FocusGranularity = 'day' | 'week' | 'month'

/** 一个分布桶 */
export interface FocusBucket {
  /** 桶标识（day: YYYY-MM-DD；week: 周起始日；month: YYYY-MM） */
  key: string
  /** 展示标签 */
  label: string
  /** 桶内总时长（秒） */
  seconds: number
}

/**
 * 按日 / 周 / 月聚合区间 [from, to] 内的专注时长。
 * 空桶也保留（条形图连续）；周桶按 weekStart（默认周一）取所在周起始日。
 */
export function bucketFocus(
  sessions: FocusSession[],
  from: string,
  to: string,
  granularity: FocusGranularity,
  weekStart = 1,
): FocusBucket[] {
  // 1. 生成区间内所有桶（有序）
  const buckets: FocusBucket[] = []
  if (granularity === 'month') {
    let cursor = from.slice(0, 7)
    const endKey = to.slice(0, 7)
    while (cursor <= endKey) {
      const [y, m] = cursor.split('-').map(Number)
      buckets.push({ key: cursor, label: `${y}年${m}月`, seconds: 0 })
      const next = new Date(y, m, 1) // 下一个月
      cursor = formatLocal(next).slice(0, 7)
    }
  } else if (granularity === 'week') {
    let cursor = weekDates(from, weekStart)[0]
    const end = weekDates(to, weekStart)[0]
    while (cursor <= end) {
      const d = parseLocal(cursor)
      buckets.push({ key: cursor, label: `${d.getMonth() + 1}/${d.getDate()}`, seconds: 0 })
      const next = new Date(d.getTime() + 7 * 86400000)
      cursor = formatLocal(next)
    }
  } else {
    let cursor = from
    while (cursor <= to) {
      const d = parseLocal(cursor)
      buckets.push({ key: cursor, label: `${d.getMonth() + 1}/${d.getDate()}`, seconds: 0 })
      d.setDate(d.getDate() + 1)
      cursor = formatLocal(d)
    }
  }

  // 2. 会话归桶（一次遍历）
  const index = new Map<string, number>()
  buckets.forEach((b, i) => index.set(b.key, i))
  for (const s of sessions) {
    const d = sessionDate(s)
    if (d < from || d > to) continue
    const key =
      granularity === 'month'
        ? d.slice(0, 7)
        : granularity === 'week'
          ? weekDates(d, weekStart)[0]
          : d
    const i = index.get(key)
    if (i !== undefined) buckets[i].seconds += s.durationSec
  }
  return buckets
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

/* ============ 专注数据分析仪表盘（宏观总览 → 单日快照 → 分类拆解 → 时段洞察 → 中长期趋势） ============ */

/** 单日专注快照（当日卡片：回溯历史单日数据） */
export interface DailyFocusSnapshot {
  /** YYYY-MM-DD */
  date: string
  /** 当日会话数 */
  sessions: number
  /** 当日总时长（秒） */
  seconds: number
}

/** 某一自然日的专注快照 */
export function dailyFocusSnapshot(sessions: FocusSession[], date: string): DailyFocusSnapshot {
  let count = 0
  let seconds = 0
  for (const s of sessions) {
    if (sessionDate(s) === date) {
      count++
      seconds += s.durationSec
    }
  }
  return { date, sessions: count, seconds }
}

/** 自由计时（未绑定任务）会话在分类拆解中的展示名 */
export const FREE_FOCUS_LABEL = '自由计时'
/** 绑定了任务但任务无分类时的展示名 */
export const UNCATEGORIZED_FOCUS_LABEL = '未分类'

/** 分类时长切片（饼图：周期内各分类 / 自由计时的时长占比） */
export interface FocusSplitSlice {
  label: string
  /** 该分类累计时长（秒） */
  seconds: number
  /** 占比 0–100（四舍五入 1 位小数；各切片之和可能因舍入略偏离 100） */
  percent: number
}

/**
 * 区间 [from, to] 内专注时长按分类拆解：
 * - taskId 为空 → 「自由计时」；
 * - 任务已删除或无分类 → 「未分类」；
 * - 其余 → 任务分类（trim）。
 * 结果按时长降序，区间内无会话返回 []。
 */
export function categoryFocusSplit(
  sessions: FocusSession[],
  tasks: Task[],
  from: string,
  to: string,
): FocusSplitSlice[] {
  const categoryById = new Map<string, string>()
  for (const t of tasks) {
    categoryById.set(t.id, t.category?.trim() || UNCATEGORIZED_FOCUS_LABEL)
  }

  const secondsByLabel = new Map<string, number>()
  let total = 0
  for (const s of sessions) {
    const d = sessionDate(s)
    if (d < from || d > to) continue
    const label = s.taskId
      ? (categoryById.get(s.taskId) ?? UNCATEGORIZED_FOCUS_LABEL)
      : FREE_FOCUS_LABEL
    secondsByLabel.set(label, (secondsByLabel.get(label) ?? 0) + s.durationSec)
    total += s.durationSec
  }
  if (total === 0) return []

  return [...secondsByLabel.entries()]
    .map(([label, seconds]) => ({
      label,
      seconds,
      percent: Math.round((seconds / total) * 1000) / 10,
    }))
    .sort((a, b) => b.seconds - a.seconds)
}

/** 月度时段分布：24 桶（索引 = 会话开始本地小时，值 = 该小时区间累计秒数） */
export function hourlyFocusDistribution(
  sessions: FocusSession[],
  year: number,
  month: number,
): number[] {
  const hours = new Array<number>(24).fill(0)
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  for (const s of sessions) {
    const d = sessionDate(s)
    if (!d.startsWith(prefix)) continue
    hours[new Date(s.startedAt).getHours()] += s.durationSec
  }
  return hours
}

/** 月度趋势点（一个自然月内每日专注时长） */
export interface DailyTrendPoint {
  /** YYYY-MM-DD */
  date: string
  /** 日（1–31） */
  day: number
  /** 当日专注时长（秒），无会话为 0（空位保留，曲线连续） */
  seconds: number
}

/** 一个自然月内每日专注时长趋势（含空日） */
export function monthlyDailyTrend(
  sessions: FocusSession[],
  year: number,
  month: number,
): DailyTrendPoint[] {
  const secondsByDate = new Map<string, number>()
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  for (const s of sessions) {
    const d = sessionDate(s)
    if (!d.startsWith(prefix)) continue
    secondsByDate.set(d, (secondsByDate.get(d) ?? 0) + s.durationSec)
  }
  return daysInMonth(year, month).map((date) => ({
    date,
    day: parseLocal(date).getDate(),
    seconds: secondsByDate.get(date) ?? 0,
  }))
}

/** 年度趋势点（全年每月累计专注时长） */
export interface MonthlyTrendPoint {
  /** 1–12 */
  month: number
  /** 展示标签（如「1月」） */
  label: string
  /** 当月累计专注时长（秒） */
  seconds: number
}

/** 全年每月累计专注时长趋势（固定 12 个点，空月为 0） */
export function yearlyMonthlyTrend(sessions: FocusSession[], year: number): MonthlyTrendPoint[] {
  const seconds = new Array<number>(12).fill(0)
  const prefix = `${year}-`
  for (const s of sessions) {
    const d = sessionDate(s)
    if (!d.startsWith(prefix)) continue
    seconds[Number(d.slice(5, 7)) - 1] += s.durationSec
  }
  return seconds.map((sec, i) => ({ month: i + 1, label: `${i + 1}月`, seconds: sec }))
}
