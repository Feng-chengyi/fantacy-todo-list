/**
 * habit 纯函数单测：isCheckedOn / streakOf（含今天未打不断签语义）、
 * normalizeHabit（QA Bug 5：archived 恒为布尔）。
 */
import { describe, expect, it } from 'vitest'
import type { Habit } from './types'
import { isCheckedOn, normalizeHabit, streakOf } from './habit'

function habit(checkins: string[]): Habit {
  return { id: 'h1', title: '喝水', checkins }
}

describe('isCheckedOn', () => {
  it('命中 / 未命中', () => {
    const h = habit(['2025-08-15'])
    expect(isCheckedOn(h, '2025-08-15')).toBe(true)
    expect(isCheckedOn(h, '2025-08-14')).toBe(false)
  })
})

describe('streakOf', () => {
  it('今天打卡则从今天连续往前数', () => {
    const h = habit(['2025-08-15', '2025-08-14', '2025-08-13'])
    expect(streakOf(h, '2025-08-15')).toBe(3)
  })
  it('今天未打但昨天打了，不断签', () => {
    const h = habit(['2025-08-14', '2025-08-13'])
    expect(streakOf(h, '2025-08-15')).toBe(2)
  })
  it('今天和昨天都没打 = 0', () => {
    const h = habit(['2025-08-12'])
    expect(streakOf(h, '2025-08-15')).toBe(0)
  })
  it('空习惯 = 0', () => {
    expect(streakOf(habit([]), '2025-08-15')).toBe(0)
  })
  it('中间断签只算连续段', () => {
    const h = habit(['2025-08-15', '2025-08-14', '2025-08-12', '2025-08-11'])
    expect(streakOf(h, '2025-08-15')).toBe(2)
  })
})

describe('normalizeHabit（QA Bug 5：创建返回值补全 archived）', () => {
  it('缺省 archived 回填 false（新建习惯返回值口径）', () => {
    const h = normalizeHabit({ id: 'h1', title: '喝水', checkins: [] })
    expect(h.archived).toBe(false)
  })

  it('archived: true 保留', () => {
    const h = normalizeHabit({ id: 'h1', title: '喝水', checkins: [], archived: true })
    expect(h.archived).toBe(true)
  })

  it('磁盘脏数据 checkins 非数组时回填空数组（容错）', () => {
    const h = normalizeHabit({ id: 'h1', title: '喝水', checkins: 'oops' as unknown as string[] })
    expect(h.checkins).toEqual([])
    expect(h.archived).toBe(false)
  })
})
