/**
 * 专注计时领域纯函数单测（QA Bug 1 / O1 / O2 / O5 / O6 对应纯函数）。
 */
import { describe, expect, it, vi } from 'vitest'
import type { FullData, FocusSession, Task, TimerState } from './types'
import {
  applyFocusCommit,
  buildPomodoroSession,
  isSameTimerInstance,
  selectTimerCandidates,
  shouldAutoplayBgm,
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
  return { version: 1, tasks, overrides: [], goals: [], habits: [], sessions }
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

describe('buildPomodoroSession 番茄专注完成 → 会话（O2）', () => {
  it('由结束时刻回推开始时刻，时长与阶段一致', () => {
    const endedAtMs = Date.parse('2025-08-15T10:25:00.000Z')
    const s = buildPomodoroSession(25 * 60, endedAtMs)
    expect(s.durationSec).toBe(1500)
    expect(s.endedAt).toBe('2025-08-15T10:25:00.000Z')
    expect(Date.parse(s.startedAt)).toBe(endedAtMs - 1500 * 1000)
    expect(s.taskId).toBe('') // 自由计时
  })
})

describe('shouldAutoplayBgm 自动播放决策（O5）', () => {
  it('三条件全满足才自动播放', () => {
    expect(shouldAutoplayBgm({ autoplay: true, userPaused: false, bgmLoaded: true })).toBe(true)
  })
  it('任一条件不满足均不播放', () => {
    expect(shouldAutoplayBgm({ autoplay: false, userPaused: false, bgmLoaded: true })).toBe(false)
    expect(shouldAutoplayBgm({ autoplay: true, userPaused: true, bgmLoaded: true })).toBe(false)
    expect(shouldAutoplayBgm({ autoplay: true, userPaused: false, bgmLoaded: false })).toBe(false)
  })
})

describe('selectTimerCandidates 计时面板候选（O6：放宽全部 pending）', () => {
  it('只含 pending 任务（done / abandoned 排除）', () => {
    const tasks = [
      task({ id: 'p1', date: '2025-08-16' }),
      task({ id: 'd1', date: '2025-08-16', status: 'done' }),
      task({ id: 'a1', date: '2025-08-16', status: 'abandoned' }),
    ]
    expect(selectTimerCandidates(tasks).map((t) => t.id)).toEqual(['p1'])
  })

  it('不限今日：未来与过去日期任务均在候选内，按日期升序', () => {
    const tasks = [
      task({ id: 'future', date: '2025-09-01' }),
      task({ id: 'past', date: '2025-08-01' }),
      task({ id: 'today', date: '2025-08-15' }),
    ]
    expect(selectTimerCandidates(tasks).map((t) => t.id)).toEqual(['past', 'today', 'future'])
  })

  it('收集箱（date=null）殿后', () => {
    const tasks = [
      task({ id: 'inbox', date: null }),
      task({ id: 'dated', date: '2099-01-01' }),
    ]
    expect(selectTimerCandidates(tasks).map((t) => t.id)).toEqual(['dated', 'inbox'])
  })

  it('同日期内按标题排序（顺序稳定）', () => {
    const tasks = [
      task({ id: 'b', date: '2025-08-15', title: '背单词' }),
      task({ id: 'a', date: '2025-08-15', title: '阅读' }),
    ]
    expect(selectTimerCandidates(tasks).map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('不修改入参数组顺序', () => {
    const tasks = [task({ id: 'inbox', date: null }), task({ id: 'dated', date: '2025-08-15' })]
    selectTimerCandidates(tasks)
    expect(tasks.map((t) => t.id)).toEqual(['inbox', 'dated'])
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
