/**
 * conflict 纯函数单测：半开区间重叠 / 同日约束 / 缺时间区间。
 */
import { describe, expect, it } from 'vitest'
import type { Task } from './types'
import { detectConflicts, hasOverlap, hasTimeRange } from './conflict'

function t(over: Partial<Task> & { id: string }): Task {
  return {
    title: '任务',
    priority: 'medium',
    date: '2025-08-15',
    status: 'pending',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    tags: [],
    ...over,
  }
}

describe('hasOverlap', () => {
  it('半开区间：相邻不重叠', () => {
    const a = t({ id: 'a', startTime: '09:00', endTime: '10:00' })
    const b = t({ id: 'b', startTime: '10:00', endTime: '11:00' })
    expect(hasOverlap(a, b)).toBe(false)
  })
  it('区间相交重叠', () => {
    const a = t({ id: 'a', startTime: '09:00', endTime: '11:00' })
    const b = t({ id: 'b', startTime: '10:00', endTime: '12:00' })
    expect(hasOverlap(a, b)).toBe(true)
  })
  it('不同日期不冲突', () => {
    const a = t({ id: 'a', date: '2025-08-15', startTime: '09:00', endTime: '11:00' })
    const b = t({ id: 'b', date: '2025-08-16', startTime: '09:00', endTime: '11:00' })
    expect(hasOverlap(a, b)).toBe(false)
  })
  it('缺少时间区间不冲突', () => {
    const a = t({ id: 'a', startTime: '09:00', endTime: '11:00' })
    const b = t({ id: 'b' })
    expect(hasOverlap(a, b)).toBe(false)
  })
  it('自身不冲突', () => {
    const a = t({ id: 'a', startTime: '09:00', endTime: '11:00' })
    expect(hasOverlap(a, a)).toBe(false)
  })
})

describe('detectConflicts', () => {
  it('返回所有冲突对', () => {
    const a = t({ id: 'a', startTime: '09:00', endTime: '10:30' })
    const b = t({ id: 'b', startTime: '10:00', endTime: '11:00' })
    const c = t({ id: 'c', startTime: '14:00', endTime: '15:00' })
    const pairs = detectConflicts([a, b, c])
    expect(pairs.length).toBe(1)
    expect([pairs[0].a.id, pairs[0].b.id].sort()).toEqual(['a', 'b'])
  })
})

describe('hasTimeRange', () => {
  it('成对才有效', () => {
    expect(hasTimeRange(t({ id: 'a', startTime: '09:00', endTime: '10:00' }))).toBe(true)
    expect(hasTimeRange(t({ id: 'a', startTime: '09:00' }))).toBe(false)
    expect(hasTimeRange(t({ id: 'a' }))).toBe(false)
  })
})
