import { describe, expect, it } from 'vitest'
import { groupSessionsByDate, sessionRangeLabel, summarizeDay } from './sessionView'
import type { FocusSession } from './types'

/** 本地时间构造：避免 UTC 偏移导致的日期归属歧义 */
function session(patch: Partial<FocusSession>): FocusSession {
  return {
    id: patch.id ?? 's1',
    taskId: patch.taskId ?? 'task-a',
    startedAt: patch.startedAt ?? '2026-08-17T09:00:00',
    endedAt: patch.endedAt ?? '2026-08-17T09:30:00',
    durationSec: patch.durationSec ?? 1800,
    occurrenceDate: patch.occurrenceDate ?? null,
  }
}

describe('groupSessionsByDate 按本地日期分组', () => {
  it('按会话开始时刻的本地日期分到对应日期组', () => {
    const map = groupSessionsByDate([
      session({ id: 'a', startedAt: '2026-08-17T23:50:00', endedAt: '2026-08-17T23:55:00' }),
      session({ id: 'b', startedAt: '2026-08-18T08:00:00', endedAt: '2026-08-18T08:25:00' }),
    ])
    expect([...map.keys()]).toEqual(['2026-08-17', '2026-08-18'])
    expect(map.get('2026-08-17')?.map((s) => s.id)).toEqual(['a'])
  })

  it('组内按开始时间升序', () => {
    const map = groupSessionsByDate([
      session({ id: 'late', startedAt: '2026-08-17T14:00:00' }),
      session({ id: 'early', startedAt: '2026-08-17T09:00:00' }),
      session({ id: 'noon', startedAt: '2026-08-17T12:00:00' }),
    ])
    expect(map.get('2026-08-17')?.map((s) => s.id)).toEqual(['early', 'noon', 'late'])
  })

  it('跨日会话归属开始日期', () => {
    const map = groupSessionsByDate([
      session({ id: 'cross', startedAt: '2026-08-17T23:50:00', endedAt: '2026-08-18T00:20:00' }),
    ])
    expect([...map.keys()]).toEqual(['2026-08-17'])
  })

  it('空列表返回空 Map', () => {
    expect(groupSessionsByDate([]).size).toBe(0)
  })
})

describe('summarizeDay 当日汇总', () => {
  it('统计次数与总秒数（仅匹配日期）', () => {
    const sessions = [
      session({ id: 'a', startedAt: '2026-08-17T09:00:00', durationSec: 1500 }),
      session({ id: 'b', startedAt: '2026-08-17T11:00:00', durationSec: 300 }),
      session({ id: 'c', startedAt: '2026-08-16T09:00:00', durationSec: 9999 }),
    ]
    expect(summarizeDay(sessions, '2026-08-17')).toEqual({ count: 2, totalSec: 1800 })
    expect(summarizeDay(sessions, '2026-08-15')).toEqual({ count: 0, totalSec: 0 })
  })

  it('自由计时（taskId 为空串）同样计入', () => {
    const sessions = [
      session({ id: 'free', taskId: '', startedAt: '2026-08-17T20:00:00', durationSec: 600 }),
    ]
    expect(summarizeDay(sessions, '2026-08-17')).toEqual({ count: 1, totalSec: 600 })
  })
})

describe('sessionRangeLabel 时间段标签', () => {
  it('「HH:mm–HH:mm」本地时间格式', () => {
    expect(
      sessionRangeLabel(session({ startedAt: '2026-08-17T09:05:00', endedAt: '2026-08-17T09:41:30' })),
    ).toBe('09:05–09:41')
  })
})
