import { describe, expect, it } from 'vitest'
import { currentFocusStreak, maxFocusStreak } from './stats'
import type { FocusSession } from './types'

/** 本地时间构造：避免 UTC 偏移导致的日期归属歧义 */
function session(date: string): FocusSession {
  return {
    id: `s-${date}`,
    taskId: 'task-a',
    startedAt: `${date}T09:00:00`,
    endedAt: `${date}T09:30:00`,
    durationSec: 1800,
    occurrenceDate: null,
  }
}

describe('currentFocusStreak 当前连续专注天数', () => {
  it('空会话返回 0', () => {
    expect(currentFocusStreak([], '2026-08-18')).toBe(0)
  })

  it('今天有会话：从今天起算', () => {
    const sessions = [session('2026-08-18'), session('2026-08-17'), session('2026-08-16')]
    expect(currentFocusStreak(sessions, '2026-08-18')).toBe(3)
  })

  it('今天暂无会话不阻断：从昨天起算', () => {
    const sessions = [session('2026-08-17'), session('2026-08-16')]
    expect(currentFocusStreak(sessions, '2026-08-18')).toBe(2)
  })

  it('中断后仅统计最近连续段', () => {
    const sessions = [session('2026-08-17'), session('2026-08-16'), session('2026-08-13')]
    expect(currentFocusStreak(sessions, '2026-08-18')).toBe(2)
  })

  it('同日多会话只计一天', () => {
    const sessions = [session('2026-08-18'), session('2026-08-18'), session('2026-08-17')]
    expect(currentFocusStreak(sessions, '2026-08-18')).toBe(2)
  })
})

describe('maxFocusStreak 历史最长连续专注天数', () => {
  it('空会话返回 0', () => {
    expect(maxFocusStreak([])).toBe(0)
  })

  it('取全部日期中的最长连续段', () => {
    // 连续段：08-10 ~ 08-13（4 天）与 08-16 ~ 08-17（2 天）
    const sessions = [
      session('2026-08-10'),
      session('2026-08-11'),
      session('2026-08-12'),
      session('2026-08-13'),
      session('2026-08-16'),
      session('2026-08-17'),
    ]
    expect(maxFocusStreak(sessions)).toBe(4)
  })

  it('同日多会话不虚增长度', () => {
    const sessions = [session('2026-08-10'), session('2026-08-10'), session('2026-08-11')]
    expect(maxFocusStreak(sessions)).toBe(2)
  })

  it('单日会话返回 1', () => {
    expect(maxFocusStreak([session('2026-08-10')])).toBe(1)
  })
})
