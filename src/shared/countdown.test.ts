/**
 * countdown 纯函数单测：未来 / 当天 / 已过 + 排序。
 */
import { describe, expect, it } from 'vitest'
import { daysUntil, sortGoalsByDays } from './countdown'

describe('daysUntil', () => {
  it('未来日期为正', () => {
    expect(daysUntil('2025-08-20', '2025-08-15')).toBe(5)
  })
  it('当天为 0', () => {
    expect(daysUntil('2025-08-15', '2025-08-15')).toBe(0)
  })
  it('已过为负', () => {
    expect(daysUntil('2025-08-10', '2025-08-15')).toBe(-5)
  })
})

describe('sortGoalsByDays', () => {
  const today = '2025-08-15'
  const g = (id: string, targetDate: string) => ({ id, targetDate })

  it('未来目标按剩余天数升序、当天最先', () => {
    const sorted = sortGoalsByDays([g('a', '2025-08-30'), g('b', '2025-08-15'), g('c', '2025-08-20')], today)
    expect(sorted.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('已过目标排在最后，且越近越靠前', () => {
    const sorted = sortGoalsByDays([g('a', '2025-08-01'), g('b', '2025-08-20'), g('c', '2025-08-14')], today)
    expect(sorted.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('未来整体排在已过之前', () => {
    const sorted = sortGoalsByDays([g('a', '2025-08-10'), g('b', '2025-08-16')], today)
    expect(sorted.map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('不修改入参数组', () => {
    const input = [g('a', '2025-08-30'), g('b', '2025-08-16')]
    sortGoalsByDays(input, today)
    expect(input.map((x) => x.id)).toEqual(['a', 'b'])
  })
})
