/**
 * 专注计时领域纯函数单测（QA Bug 1 / O1 对应纯函数）。
 */
import { describe, expect, it, vi } from 'vitest'
import type { FullData, FocusSession, Task, TimerState } from './types'
import {
  applyFocusClearRange,
  applyFocusCommit,
  applyFocusDelete,
  applyFocusReset,
  isSameTimerInstance,
  sessionLocalDate,
  shouldRecordFocus,
  timerElapsedMs,
} from './focus'

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: '任务',
    priority: 'medium',
    date: null,
    status: 'pending',
    createdAt: '2025-08-15T00:00:00.000Z',
    updatedAt: '2025-08-15T00:00:00.000Z',
    tags: [],
    ...over,
  }
}

function fullData(tasks: Task[], sessions: FocusSession[] = []): FullData {
  return { version: 1, tasks, overrides: [], goals: [], habits: [], sessions, collections: [], activities: [] }
}

function session(over: Partial<FocusSession> & { id: string }): FocusSession {
  return {
    taskId: '',
    startedAt: '2025-08-15T10:00:00.000Z',
    endedAt: '2025-08-15T10:25:00.000Z',
    durationSec: 1500,
    ...over,
  }
}

describe('shouldRecordFocus 专注记录下限（Bug 1：切换任务不丢上一任务时长）', () => {
  it('低于 5 秒不计入', () => {
    expect(shouldRecordFocus(0)).toBe(false)
    expect(shouldRecordFocus(4)).toBe(false)
  })
  it('达到 5 秒计入', () => {
    expect(shouldRecordFocus(5)).toBe(true)
    expect(shouldRecordFocus(3600)).toBe(true)
  })
})

describe('applyFocusCommit 原子提交（O1：session 追加 + durationSec 累加一次完成）', () => {
  it('绑定任务：durationSec 累加且 sessions 追加', () => {
    const data = fullData([task({ id: 't1', durationSec: 100 })], [session({ id: 's0' })])
    const next = applyFocusCommit(data, session({ id: 's1', taskId: 't1', durationSec: 300 }))
    expect(next.tasks[0].durationSec).toBe(400)
    expect(next.sessions.map((s) => s.id)).toEqual(['s0', 's1'])
  })

  it('自由计时（taskId 空串）：只追加会话，不动任何任务', () => {
    const data = fullData([task({ id: 't1', durationSec: 100 })])
    const next = applyFocusCommit(data, session({ id: 's1', taskId: '', durationSec: 60 }))
    expect(next.tasks[0].durationSec).toBe(100)
    expect(next.sessions).toHaveLength(1)
  })

  it('绑定的任务不存在：不抛错，仅追加会话（容错）', () => {
    const data = fullData([task({ id: 't1' })])
    const next = applyFocusCommit(data, session({ id: 's1', taskId: 'ghost', durationSec: 60 }))
    expect(next.tasks).toHaveLength(1)
    expect(next.tasks[0].durationSec).toBeUndefined()
    expect(next.sessions).toHaveLength(1)
  })

  it('不可变：不修改入参 data', () => {
    const data = fullData([task({ id: 't1', durationSec: 100 })], [])
    applyFocusCommit(data, session({ id: 's1', taskId: 't1', durationSec: 300 }))
    expect(data.tasks[0].durationSec).toBe(100)
    expect(data.sessions).toHaveLength(0)
  })

  it('durationSec 缺省按 0 累加', () => {
    const data = fullData([task({ id: 't1' })])
    const next = applyFocusCommit(data, session({ id: 's1', taskId: 't1', durationSec: 300 }))
    expect(next.tasks[0].durationSec).toBe(300)
  })
})

describe('统计数据清除：sessionLocalDate 本地日期口径', () => {
  it('ISO 时刻 → 本地 YYYY-MM-DD', () => {
    // 本地构造，不依赖运行时区
    expect(sessionLocalDate(new Date(2025, 7, 15, 23, 30).toISOString())).toBe('2025-08-15')
    expect(sessionLocalDate(new Date(2025, 0, 1, 0, 5).toISOString())).toBe('2025-01-01')
  })
})

describe('applyFocusDelete 删除单条专注记录', () => {
  it('删除指定会话并扣减绑定任务 durationSec', () => {
    const data = fullData([task({ id: 't1', durationSec: 400 })], [
      session({ id: 's0', taskId: 't1', durationSec: 100 }),
      session({ id: 's1', taskId: 't1', durationSec: 300 }),
    ])
    const next = applyFocusDelete(data, 's1')
    expect(next.sessions.map((s) => s.id)).toEqual(['s0'])
    expect(next.tasks[0].durationSec).toBe(100)
  })

  it('自由计时会话：仅删除会话，不动任务', () => {
    const data = fullData([task({ id: 't1', durationSec: 100 })], [
      session({ id: 's1', taskId: '', durationSec: 300 }),
    ])
    const next = applyFocusDelete(data, 's1')
    expect(next.sessions).toHaveLength(0)
    expect(next.tasks[0].durationSec).toBe(100)
  })

  it('绑定的任务已被删除：仅删会话不抛错', () => {
    const data = fullData([], [session({ id: 's1', taskId: 'ghost', durationSec: 300 })])
    const next = applyFocusDelete(data, 's1')
    expect(next.sessions).toHaveLength(0)
  })

  it('扣减下限为 0（durationSec 不出现负数）', () => {
    const data = fullData([task({ id: 't1', durationSec: 100 })], [
      session({ id: 's1', taskId: 't1', durationSec: 300 }),
    ])
    const next = applyFocusDelete(data, 's1')
    expect(next.tasks[0].durationSec).toBe(0)
  })

  it('记录不存在：原样返回（引用相等）', () => {
    const data = fullData([task({ id: 't1' })], [session({ id: 's1' })])
    expect(applyFocusDelete(data, 'missing')).toBe(data)
  })

  it('不可变：不修改入参 data', () => {
    const data = fullData([task({ id: 't1', durationSec: 400 })], [
      session({ id: 's1', taskId: 't1', durationSec: 300 }),
    ])
    applyFocusDelete(data, 's1')
    expect(data.tasks[0].durationSec).toBe(400)
    expect(data.sessions).toHaveLength(1)
  })
})

describe('applyFocusClearRange 清空指定周期数据', () => {
  // 本地时刻构造（不依赖运行时区）：8/14 两条、8/15 两条、8/16 一条
  const sessions = [
    session({ id: 'a1', taskId: 't1', startedAt: new Date(2025, 7, 14, 10, 0).toISOString(), durationSec: 600 }),
    session({ id: 'a2', taskId: 't2', startedAt: new Date(2025, 7, 14, 11, 0).toISOString(), durationSec: 300 }),
    session({ id: 'b1', taskId: 't1', startedAt: new Date(2025, 7, 15, 9, 0).toISOString(), durationSec: 1200 }),
    session({ id: 'b2', taskId: '', startedAt: new Date(2025, 7, 15, 22, 0).toISOString(), durationSec: 180 }),
    session({ id: 'c1', taskId: 't2', startedAt: new Date(2025, 7, 16, 9, 0).toISOString(), durationSec: 60 }),
  ]
  const tasks = [task({ id: 't1', durationSec: 1800 }), task({ id: 't2', durationSec: 360 })]

  it('按本地日期闭区间清除：区间内会话移除、区间外保留', () => {
    const next = applyFocusClearRange(fullData(tasks, sessions), '2025-08-15', '2025-08-15')
    expect(next.sessions.map((s) => s.id)).toEqual(['a1', 'a2', 'c1'])
  })

  it('多任务 durationSec 按被删会话分别扣减', () => {
    const next = applyFocusClearRange(fullData(tasks, sessions), '2025-08-14', '2025-08-15')
    // t1 删 a1(600) + b1(1200) → 1800-1800 = 0；t2 删 a2(300) → 360-300 = 60
    const t1 = next.tasks.find((t) => t.id === 't1')
    const t2 = next.tasks.find((t) => t.id === 't2')
    expect(t1?.durationSec).toBe(0)
    expect(t2?.durationSec).toBe(60)
  })

  it('区间边界（from=to）与跨月区间均生效', () => {
    const next = applyFocusClearRange(fullData(tasks, sessions), '2025-08-14', '2025-08-16')
    expect(next.sessions).toHaveLength(0)
  })

  it('区间内无匹配：原样返回（引用相等）', () => {
    const data = fullData(tasks, sessions)
    expect(applyFocusClearRange(data, '2030-01-01', '2030-12-31')).toBe(data)
  })

  it('非法区间（from > to / 空串）：原样返回', () => {
    const data = fullData(tasks, sessions)
    expect(applyFocusClearRange(data, '2025-08-16', '2025-08-14')).toBe(data)
    expect(applyFocusClearRange(data, '', '2025-08-14')).toBe(data)
  })
})

describe('applyFocusReset 一键重置全部统计数据', () => {
  it('清空全部会话，所有任务 durationSec 归零', () => {
    const data = fullData(
      [task({ id: 't1', durationSec: 1800 }), task({ id: 't2' })],
      [
        session({ id: 's1', taskId: 't1', durationSec: 1800 }),
        session({ id: 's2', taskId: '', durationSec: 60 }),
      ],
    )
    const next = applyFocusReset(data)
    expect(next.sessions).toHaveLength(0)
    expect(next.tasks.every((t) => t.durationSec === 0)).toBe(true)
  })

  it('保留 tasks 之外的其余字段（goals / habits 等不受影响）', () => {
    const data = fullData([task({ id: 't1', durationSec: 60 })], [session({ id: 's1' })])
    data.goals.push({
      id: 'g1',
      title: '目标',
      targetDate: '2025-12-31',
      createdAt: '2025-08-01T00:00:00.000Z',
      category: '',
      color: '',
    })
    const next = applyFocusReset(data)
    expect(next.goals).toHaveLength(1)
    expect(next.overrides).toBe(data.overrides)
  })

  it('不可变：不修改入参 data', () => {
    const data = fullData([task({ id: 't1', durationSec: 100 })], [session({ id: 's1' })])
    applyFocusReset(data)
    expect(data.tasks[0].durationSec).toBe(100)
    expect(data.sessions).toHaveLength(1)
  })
})

describe('isSameTimerInstance 重复计时日期隔离（Bug：仅被开启计时的实例显示计时态）', () => {
  const timer = (taskId: string, occurrenceDate: string | null): TimerState => ({
    taskId,
    occurrenceDate,
    startedAt: Date.now(),
    beginAt: Date.now(),
    accumMs: 0,
    paused: false,
  })

  it('同任务 + 同实例日期 → true', () => {
    expect(isSameTimerInstance(timer('t1', '2025-08-15'), 't1', '2025-08-15')).toBe(true)
  })

  it('同任务 + 不同实例日期 → false（重复任务实例隔离核心）', () => {
    expect(isSameTimerInstance(timer('t1', '2025-08-15'), 't1', '2025-08-16')).toBe(false)
  })

  it('不同任务 → false', () => {
    expect(isSameTimerInstance(timer('t1', '2025-08-15'), 't2', '2025-08-15')).toBe(false)
  })

  it('任务级 / 自由计时（双方 occurrenceDate 均为 null）→ true', () => {
    expect(isSameTimerInstance(timer('t1', null), 't1', null)).toBe(true)
  })

  it('任务级计时（occurrenceDate=null）不匹配具体实例日期', () => {
    expect(isSameTimerInstance(timer('t1', null), 't1', '2025-08-15')).toBe(false)
  })
})

describe('timerElapsedMs 走时计算', () => {
  it('暂停时冻结为累计毫秒，忽略 startedAt', () => {
    const t: TimerState = {
      taskId: '',
      occurrenceDate: null,
      startedAt: Date.now(),
      beginAt: 0,
      accumMs: 5000,
      paused: true,
    }
    expect(timerElapsedMs(t)).toBe(5000)
  })

  it('进行中 = accumMs + (now - startedAt)', () => {
    vi.useFakeTimers()
    try {
      const now = 1_000_000
      vi.setSystemTime(now)
      const t: TimerState = {
        taskId: '',
        occurrenceDate: null,
        startedAt: now - 3000,
        beginAt: 0,
        accumMs: 5000,
        paused: false,
      }
      expect(timerElapsedMs(t)).toBe(8000)
    } finally {
      vi.useRealTimers()
    }
  })
})
