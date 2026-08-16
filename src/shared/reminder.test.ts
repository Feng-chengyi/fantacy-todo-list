/**
 * reminder 领域纯函数单测：去重键 / 触发时间 / 今日实例展开 / 回溯窗口过滤。
 */
import { describe, expect, it } from 'vitest'
import { parseLocal } from './date'
import type { FullData, RepeatOverride, Task, TaskReminder } from './types'
import {
  listDueReminders,
  listTodayReminders,
  reminderKey,
  resolveReminderAt,
} from './reminder'

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

function reminder(time: string): TaskReminder {
  return { time }
}

function fullData(tasks: Task[], overrides: RepeatOverride[] = []): FullData {
  return { version: 1, tasks, overrides, goals: [], habits: [], sessions: [] }
}

/** 某日期某时刻的本地毫秒时间戳（与 listDueReminders 的本地口径一致） */
function at(date: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return parseLocal(date).getTime() + h * 3_600_000 + m * 60_000
}

describe('reminderKey 去重键', () => {
  it('任务 + 日期组合成唯一键', () => {
    expect(reminderKey('t1', '2025-08-15')).toBe('t1@2025-08-15')
  })
})

describe('resolveReminderAt 触发时间', () => {
  it('合法时间返回当日该时刻的毫秒时间戳', () => {
    const t = task({ id: 't1', date: '2025-08-15', reminder: reminder('09:30') })
    expect(resolveReminderAt(t, '2025-08-15')).toBe(at('2025-08-15', '09:30'))
  })
  it('无提醒返回 null', () => {
    const t = task({ id: 't1', date: '2025-08-15' })
    expect(resolveReminderAt(t, '2025-08-15')).toBeNull()
  })
  it('时间非法（非 HH:mm / 越界）返回 null', () => {
    for (const bad of ['9', '09:60', '24:00', 'abc']) {
      const t = task({ id: 't1', date: '2025-08-15', reminder: reminder(bad) })
      expect(resolveReminderAt(t, '2025-08-15')).toBeNull()
    }
  })
})

describe('listTodayReminders 今日待提醒实例', () => {
  it('仅返回今日 pending 且带提醒的任务', () => {
    const data = fullData([
      task({ id: 'a', date: '2025-08-15', reminder: reminder('09:00') }),
      task({ id: 'b', date: '2025-08-15', reminder: reminder('10:00'), status: 'done' }),
      task({ id: 'c', date: '2025-08-16', reminder: reminder('09:00') }),
      task({ id: 'd', date: null, reminder: reminder('09:00') }),
    ])
    const list = listTodayReminders(data, '2025-08-15')
    expect(list.map((r) => r.taskId)).toEqual(['a'])
  })
  it('重复任务：今日命中且未完成才提醒', () => {
    const data = fullData(
      [
        task({
          id: 'r1',
          date: '2025-08-15',
          reminder: reminder('09:00'),
          repeat: { type: 'daily', interval: 1 },
        }),
        task({
          id: 'r2',
          date: '2025-08-15',
          reminder: reminder('09:00'),
          repeat: { type: 'daily', interval: 1 },
        }),
      ],
      [{ id: 'o1', taskId: 'r2', occurrenceDate: '2025-08-15', action: 'done' }],
    )
    const list = listTodayReminders(data, '2025-08-15')
    expect(list.map((r) => r.taskId)).toEqual(['r1'])
  })
})

describe('listDueReminders 回溯窗口过滤', () => {
  it('已到点且未超回溯窗口的提醒返回', () => {
    const data = fullData([task({ id: 't1', date: '2025-08-15', reminder: reminder('09:00') })])
    const now = at('2025-08-15', '09:05')
    expect(listDueReminders(data, now).map((r) => r.taskId)).toEqual(['t1'])
  })
  it('未来未到点的提醒不返回', () => {
    const data = fullData([task({ id: 't1', date: '2025-08-15', reminder: reminder('10:00') })])
    const now = at('2025-08-15', '09:00')
    expect(listDueReminders(data, now)).toEqual([])
  })
  it('超过 1 小时回溯窗口的提醒不返回（补触发上限）', () => {
    const data = fullData([task({ id: 't1', date: '2025-08-15', reminder: reminder('07:00') })])
    const now = at('2025-08-15', '09:00')
    expect(listDueReminders(data, now)).toEqual([])
  })
  it('回溯窗口边界（恰 1 小时）返回', () => {
    const data = fullData([task({ id: 't1', date: '2025-08-15', reminder: reminder('08:00') })])
    const now = at('2025-08-15', '09:00')
    expect(listDueReminders(data, now).map((r) => r.taskId)).toEqual(['t1'])
  })
  it('重复任务：锚点实例日到期触发（listDueReminders 组合重复展开）', () => {
    const data = fullData([
      task({ id: 'r1', date: '2025-08-15', reminder: reminder('09:00'), repeat: { type: 'daily', interval: 1 } }),
    ])
    const now = at('2025-08-15', '09:05')
    expect(listDueReminders(data, now).map((r) => r.taskId)).toEqual(['r1'])
  })
  it('重复任务：非锚点实例日按该实例日期触发，去重键实例级唯一', () => {
    const data = fullData([
      task({ id: 'r1', date: '2025-08-15', reminder: reminder('09:00'), repeat: { type: 'daily', interval: 1 } }),
    ])
    const now = at('2025-08-20', '09:05') // 非锚点实例日
    const due = listDueReminders(data, now)
    expect(due.map((r) => r.taskId)).toEqual(['r1'])
    expect(due[0].key).toBe('r1@2025-08-20')
  })
})
