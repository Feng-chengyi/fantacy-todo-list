/**
 * computeStats / 专注统计（computeFocusSummary、bucketFocus）单测。
 */
import { describe, expect, it } from 'vitest'
import type { FocusSession, RepeatOverride, Task } from './types'
import { bucketFocus, computeFocusSummary, computeStats } from './stats'

/** 构造一个最小合法任务 */
function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: '任务',
    priority: 'medium',
    date: null,
    status: 'pending',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    tags: [],
    ...over,
  }
}

const TODAY = '2025-08-15' // 周五

describe('computeStats 今日/本周/累计完成率', () => {
  it('非重复任务今日完成率', () => {
    const tasks = [
      task({ id: 't1', date: TODAY, status: 'done' }),
      task({ id: 't2', date: TODAY, status: 'pending' }),
      task({ id: 't3', date: '2025-08-16', status: 'done' }),
    ]
    const s = computeStats(tasks, [], { today: TODAY })
    expect(s.today).toEqual({ total: 2, done: 1 })
  })

  it('重复任务按当日实例展开（override done 计入）', () => {
    // 每天重复，锚点 2025-08-13
    const tasks = [
      task({ id: 'r1', date: '2025-08-13', priority: 'high', repeat: { type: 'daily', interval: 1 } }),
    ]
    const overrides: RepeatOverride[] = [
      { id: 'o1', taskId: 'r1', occurrenceDate: TODAY, action: 'done' },
    ]
    const s = computeStats(tasks, overrides, { today: TODAY })
    expect(s.today.total).toBe(1)
    expect(s.today.done).toBe(1)
  })

  it('重复任务 skipped 实例不计入分母', () => {
    const tasks = [
      task({ id: 'r1', date: '2025-08-13', repeat: { type: 'daily', interval: 1 } }),
    ]
    const overrides: RepeatOverride[] = [
      { id: 'o1', taskId: 'r1', occurrenceDate: TODAY, action: 'skipped' },
    ]
    const s = computeStats(tasks, overrides, { today: TODAY })
    expect(s.today).toEqual({ total: 0, done: 0 })
  })

  it('abandoned 任务不计入今日完成率分母', () => {
    const tasks = [
      task({ id: 't1', date: TODAY, status: 'abandoned' }),
      task({ id: 't2', date: TODAY, status: 'done' }),
    ]
    const s = computeStats(tasks, [], { today: TODAY })
    expect(s.today).toEqual({ total: 1, done: 1 })
  })

  it('累计完成率为任务级（排除 abandoned）', () => {
    const tasks = [
      task({ id: 't1', status: 'done', date: TODAY }),
      task({ id: 't2', status: 'pending', date: TODAY }),
      task({ id: 't3', status: 'abandoned', date: null }),
    ]
    const s = computeStats(tasks, [], { today: TODAY })
    expect(s.cumulative).toEqual({ total: 2, done: 1 })
    expect(s.counts).toEqual({ total: 3, done: 1, pending: 1, abandoned: 1 })
  })
})

describe('computeStats 连续打卡', () => {
  it('从今天往前数连续完成天数', () => {
    const tasks = [
      task({ id: 't1', date: TODAY, status: 'done' }),
      task({ id: 't2', date: '2025-08-14', status: 'done' }),
      task({ id: 't3', date: '2025-08-13', status: 'done' }),
      // 08-12 空缺 → streak 止于 3
    ]
    const s = computeStats(tasks, [], { today: TODAY })
    expect(s.streak).toBe(3)
  })

  it('今天无完成则 streak=0', () => {
    const tasks = [task({ id: 't1', date: '2025-08-14', status: 'done' })]
    const s = computeStats(tasks, [], { today: TODAY })
    expect(s.streak).toBe(0)
  })

  it('重复任务当日 done 实例计入 streak', () => {
    const tasks = [task({ id: 'r1', date: '2025-08-13', repeat: { type: 'daily', interval: 1 } })]
    const overrides: RepeatOverride[] = [
      { id: 'o1', taskId: 'r1', occurrenceDate: TODAY, action: 'done' },
    ]
    const s = computeStats(tasks, overrides, { today: TODAY })
    expect(s.streak).toBe(1)
  })
})

describe('computeStats 优先级与分类分布', () => {
  it('按任务计数优先级与分类', () => {
    const tasks = [
      task({ id: 't1', priority: 'high', category: '工作' }),
      task({ id: 't2', priority: 'high', category: '工作' }),
      task({ id: 't3', priority: 'medium', category: '生活' }),
      task({ id: 't4', priority: 'low' }), // 未分类不计入分类分布
    ]
    const s = computeStats(tasks, [], { today: TODAY })
    expect(s.priorityDistribution).toEqual({ high: 2, medium: 1, low: 1 })
    expect(s.categoryDistribution).toEqual({ 工作: 2, 生活: 1 })
  })

  it('分类 trim 且忽略空字符串', () => {
    const tasks = [
      task({ id: 't1', category: ' 学习 ' }),
      task({ id: 't2', category: '   ' }),
    ]
    const s = computeStats(tasks, [], { today: TODAY })
    expect(s.categoryDistribution).toEqual({ 学习: 1 })
  })
})

/** 构造一个最小合法专注会话（startedAt 只取日期部分做归属日） */
function session(over: Partial<FocusSession> & { id: string; startedAt: string; durationSec: number }): FocusSession {
  return { taskId: '', endedAt: over.startedAt, ...over }
}

describe('computeFocusSummary 专注统计汇总', () => {
  it('总数/总时长/当日指标正确，日均 = 总时长 / 含首尾天数', () => {
    const sessions = [
      session({ id: 'f1', startedAt: '2025-08-14T10:00:00.000Z', durationSec: 1500 }),
      session({ id: 'f2', startedAt: '2025-08-14T11:00:00.000Z', durationSec: 300 }),
      session({ id: 'f3', startedAt: '2025-08-15T09:00:00.000Z', durationSec: 600 }),
    ]
    const s = computeFocusSummary(sessions, { today: TODAY })
    expect(s.totalSessions).toBe(3)
    expect(s.totalSeconds).toBe(2400)
    // from 默认 = 最早会话日 08-14，到 today 08-15 → 2 天
    expect(s.avgSecondsPerDay).toBe(1200)
    expect(s.todaySessions).toBe(1)
    expect(s.todaySeconds).toBe(600)
  })

  it('from 区间过滤生效', () => {
    const sessions = [
      session({ id: 'f1', startedAt: '2025-08-14T10:00:00.000Z', durationSec: 1500 }),
      session({ id: 'f2', startedAt: '2025-08-15T09:00:00.000Z', durationSec: 600 }),
    ]
    const s = computeFocusSummary(sessions, { from: TODAY, today: TODAY })
    expect(s.totalSessions).toBe(1)
    expect(s.totalSeconds).toBe(600)
    expect(s.avgSecondsPerDay).toBe(600)
  })

  it('无会话时全零且不抛错', () => {
    const s = computeFocusSummary([], { today: TODAY })
    expect(s).toEqual({
      totalSessions: 0,
      totalSeconds: 0,
      avgSecondsPerDay: 0,
      todaySessions: 0,
      todaySeconds: 0,
    })
  })
})

describe('bucketFocus 专注分布', () => {
  const sessions = [
    session({ id: 'f1', startedAt: '2025-08-13T10:00:00.000Z', durationSec: 600 }),
    session({ id: 'f2', startedAt: '2025-08-15T09:00:00.000Z', durationSec: 1800 }),
  ]

  it('按日：空桶保留且顺序连续', () => {
    const buckets = bucketFocus(sessions, '2025-08-13', '2025-08-15', 'day')
    expect(buckets.map((b) => b.seconds)).toEqual([600, 0, 1800])
    expect(buckets.map((b) => b.key)).toEqual(['2025-08-13', '2025-08-14', '2025-08-15'])
  })

  it('按周：默认周一起始，跨周归桶（08-13 三 → 08-11 周一桶）', () => {
    const buckets = bucketFocus(sessions, '2025-08-11', '2025-08-17', 'week')
    // 区间恰为一整周：1 个桶，两段会话都归入周一 08-11 桶
    expect(buckets.length).toBe(1)
    expect(buckets[0].key).toBe('2025-08-11')
    expect(buckets[0].seconds).toBe(2400)
  })

  it('按周：周起始日 0（周日）时归桶不同', () => {
    const buckets = bucketFocus([sessions[0]], '2025-08-10', '2025-08-16', 'week', 0)
    expect(buckets.length).toBe(1)
    expect(buckets[0].key).toBe('2025-08-10') // 08-13 三所在周（周日起始）从 08-10 开始
    expect(buckets[0].seconds).toBe(600)
  })

  it('按月：跨月桶与标签', () => {
    const s2 = [
      session({ id: 'm1', startedAt: '2025-07-31T10:00:00.000Z', durationSec: 60 }),
      session({ id: 'm2', startedAt: '2025-08-01T10:00:00.000Z', durationSec: 120 }),
    ]
    const buckets = bucketFocus(s2, '2025-07-01', '2025-08-31', 'month')
    expect(buckets.map((b) => b.key)).toEqual(['2025-07', '2025-08'])
    expect(buckets[0].label).toBe('2025年7月')
    expect(buckets.map((b) => b.seconds)).toEqual([60, 120])
  })

  it('区间外会话不计入', () => {
    const buckets = bucketFocus(sessions, '2025-08-15', '2025-08-15', 'day')
    expect(buckets).toEqual([{ key: '2025-08-15', label: '8/15', seconds: 1800 }])
  })
})

describe('sessionDate 本地时区归属（QA Bug 2：ISO(UTC) 日期 ≠ 本地日期）', () => {
  it('本地凌晨会话归属本地日期（UTC+ 时区下 ISO 日期是前一天，旧 slice 实现错归）', () => {
    // 本地 2025-08-15 00:30：在 UTC+8 下 ISO 为 2025-08-14T16:30Z
    const startedAt = new Date(2025, 7, 15, 0, 30).toISOString()
    const sessions = [session({ id: 'tz1', startedAt, durationSec: 600 })]
    const s = computeFocusSummary(sessions, { today: '2025-08-15' })
    expect(s.todaySessions).toBe(1)
    expect(s.todaySeconds).toBe(600)
  })

  it('本地深夜会话归属本地日期（UTC- 时区下 ISO 日期是后一天）', () => {
    // 本地 2025-08-15 23:30：在 UTC-5 下 ISO 为 2025-08-16T04:30Z
    const startedAt = new Date(2025, 7, 15, 23, 30).toISOString()
    const sessions = [session({ id: 'tz2', startedAt, durationSec: 300 })]
    const s = computeFocusSummary(sessions, { today: '2025-08-15' })
    expect(s.todaySessions).toBe(1)
    expect(s.todaySeconds).toBe(300)
  })

  it('bucketFocus 按日归桶同样走本地日期口径', () => {
    const startedAt = new Date(2025, 7, 15, 0, 30).toISOString()
    const buckets = bucketFocus(
      [session({ id: 'tz3', startedAt, durationSec: 60 })],
      '2025-08-15',
      '2025-08-15',
      'day',
    )
    expect(buckets).toHaveLength(1)
    expect(buckets[0].seconds).toBe(60)
  })

  it('本地正午会话：新旧口径一致（回归保护）', () => {
    const startedAt = new Date(2025, 7, 15, 12, 0).toISOString()
    const s = computeFocusSummary([session({ id: 'tz4', startedAt, durationSec: 60 })], {
      today: '2025-08-15',
    })
    expect(s.todaySessions).toBe(1)
  })
})
