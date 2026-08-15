/**
 * computeStats 单测：今日/本周/累计完成率、连续打卡、计数、优先级与分类分布。
 */
import { describe, expect, it } from 'vitest'
import type { RepeatOverride, Task } from './types'
import { computeStats } from './stats'

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
