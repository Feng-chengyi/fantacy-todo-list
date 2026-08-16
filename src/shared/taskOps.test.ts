/**
 * 任务状态流转纯函数单测（QA O4：completedAt 只在 done 时有意义）、
 * 重复任务拖动平移（shiftRepeatOnMove：endDate 随 anchor 同步平移）。
 */
import { describe, expect, it } from 'vitest'
import type { Task } from './types'
import { isOccurrenceOnDate } from './repeatEngine'
import { applyTaskStatus, shiftRepeatOnMove } from './taskOps'

const NOW = '2025-08-15T12:00:00.000Z'

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
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

describe('applyTaskStatus', () => {
  it('pending → done：记录 completedAt 与 updatedAt', () => {
    const next = applyTaskStatus(task(), 'done', NOW)
    expect(next.status).toBe('done')
    expect(next.completedAt).toBe(NOW)
    expect(next.updatedAt).toBe(NOW)
  })

  it('done → pending：completedAt 清空，不残留旧完成时间（O4）', () => {
    const done = task({ status: 'done', completedAt: '2025-08-10T08:00:00.000Z' })
    const next = applyTaskStatus(done, 'pending', NOW)
    expect(next.status).toBe('pending')
    expect(next.completedAt).toBeNull()
  })

  it('done → abandoned：completedAt 同样清空', () => {
    const done = task({ status: 'done', completedAt: '2025-08-10T08:00:00.000Z' })
    const next = applyTaskStatus(done, 'abandoned', NOW)
    expect(next.status).toBe('abandoned')
    expect(next.completedAt).toBeNull()
  })

  it('再次完成时 completedAt 更新为最后一次完成时间', () => {
    const reopened = task({ status: 'pending', completedAt: null })
    const next = applyTaskStatus(reopened, 'done', NOW)
    expect(next.completedAt).toBe(NOW)
  })

  it('不可变：不修改入参任务对象', () => {
    const origin = task({ status: 'done', completedAt: '2025-08-10T08:00:00.000Z' })
    applyTaskStatus(origin, 'pending', NOW)
    expect(origin.status).toBe('done')
    expect(origin.completedAt).toBe('2025-08-10T08:00:00.000Z')
  })
})

describe('shiftRepeatOnMove 重复任务拖动平移（Bug：拖出范围后系列消失）', () => {
  const repeatTask = task({
    id: 'r1',
    date: '2026-08-16',
    repeat: { type: 'daily', interval: 1, endDate: '2026-08-23' },
  })

  it('拖到范围外日期：endDate 随 anchor 平移同样天数（+8 天），系列完整落位', () => {
    const moved = shiftRepeatOnMove(repeatTask, '2026-08-24')
    expect(moved.date).toBe('2026-08-16') // date 由 taskMove 覆写，此处只管 repeat
    expect(moved.repeat?.endDate).toBe('2026-08-31')
    // 新 anchor 8/24 起、新 endDate 8/31 止，8/24 与 8/31 都命中、9/1 不命中
    expect(isOccurrenceOnDate('2026-08-24', moved.repeat!, '2026-08-24')).toBe(true)
    expect(isOccurrenceOnDate('2026-08-31', moved.repeat!, '2026-08-24')).toBe(true)
    expect(isOccurrenceOnDate('2026-09-01', moved.repeat!, '2026-08-24')).toBe(false)
  })

  it('拖到范围内日期（+2 天）：endDate 同步 +2', () => {
    const moved = shiftRepeatOnMove(repeatTask, '2026-08-18')
    expect(moved.repeat?.endDate).toBe('2026-08-25')
  })

  it('向过去拖动（-3 天）：endDate 同步 -3', () => {
    const moved = shiftRepeatOnMove(repeatTask, '2026-08-13')
    expect(moved.repeat?.endDate).toBe('2026-08-20')
  })

  it('回归：修复前只改 date 不改 endDate 时，anchor 越界导致全系列不命中', () => {
    // 模拟旧行为：date=8/24 而 endDate 仍为 8/23 → 无任何日期命中
    const broken = { ...repeatTask, date: '2026-08-24' }
    expect(isOccurrenceOnDate('2026-08-24', broken.repeat!, broken.date)).toBe(false)
    expect(isOccurrenceOnDate('2026-08-20', broken.repeat!, broken.date)).toBe(false)
  })

  it('无 endDate 的重复任务原样返回（endCount / 无限重复不受影响）', () => {
    const noEnd = task({ id: 'r2', date: '2026-08-16', repeat: { type: 'daily', interval: 1 } })
    expect(shiftRepeatOnMove(noEnd, '2026-08-24')).toBe(noEnd)
  })

  it('非重复任务原样返回', () => {
    const plain = task({ id: 't2', date: '2026-08-16' })
    expect(shiftRepeatOnMove(plain, '2026-08-24')).toBe(plain)
  })

  it('收集箱（date=null）原样返回', () => {
    const inbox = task({ id: 't3', date: null, repeat: { type: 'daily', interval: 1, endDate: '2026-08-23' } })
    expect(shiftRepeatOnMove(inbox, '2026-08-24')).toBe(inbox)
  })

  it('不可变：不修改入参的 repeat 规则', () => {
    shiftRepeatOnMove(repeatTask, '2026-08-24')
    expect(repeatTask.repeat?.endDate).toBe('2026-08-23')
  })
})
