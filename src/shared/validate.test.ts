/**
 * validateBackupBundle 单测：合法 / 缺字段 / 类型错 / 非 JSON / 标识错误 / 非法枚举。
 */
import { describe, expect, it } from 'vitest'
import type { BackupBundle } from './types'
import { validateBackupBundle } from './validate'

function validBundle(): BackupBundle {
  return {
    app: 'fantacy-todo-list',
    backupVersion: 1,
    exportedAt: '2025-08-15T08:00:00.000Z',
    data: {
      version: 1,
      tasks: [
        {
          id: 't1',
          title: '背单词',
          description: '',
          priority: 'high',
          date: '2025-08-15',
          status: 'pending',
          createdAt: '2025-08-15T08:00:00.000Z',
          updatedAt: '2025-08-15T08:00:00.000Z',
          completedAt: null,
          repeat: null,
          inboxOrder: null,
          tags: [],
        },
      ],
      overrides: [],
      goals: [],
      habits: [],
    },
    config: {
      petVisible: true,
      petPosition: { x: 1000, y: 700 },
      petScale: 1,
      selectedModel: 'haru',
      confettiEnabled: true,
      weekStart: 1,
      theme: 'system',
      pomodoroFocusMinutes: 25,
      pomodoroBreakMinutes: 5,
      showNotesInCalendar: true,
      noteTruncateLength: 30,
    },
  }
}

describe('validateBackupBundle', () => {
  it('合法 bundle 通过', () => {
    const res = validateBackupBundle(validBundle())
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.tasks.length).toBe(1)
  })

  it('缺字段（title）失败', () => {
    const b = validBundle()
    delete (b.data.tasks[0] as unknown as Record<string, unknown>).title
    const res = validateBackupBundle(b)
    expect(res.ok).toBe(false)
  })

  it('类型错（priority 非法枚举）失败', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).priority = 'urgent'
    const res = validateBackupBundle(b)
    expect(res.ok).toBe(false)
  })

  it('非 JSON（字符串/null/数字）失败', () => {
    expect(validateBackupBundle('not json').ok).toBe(false)
    expect(validateBackupBundle(null).ok).toBe(false)
    expect(validateBackupBundle(123).ok).toBe(false)
  })

  it('app 标识错误失败', () => {
    const b = validBundle()
    ;(b as unknown as Record<string, unknown>).app = 'other-app'
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('overrides 非法 action 失败', () => {
    const b = validBundle()
    b.data.overrides = [
      { id: 'o1', taskId: 't1', occurrenceDate: '2025-08-15', action: 'wrong' },
    ] as never
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('config 缺字段失败', () => {
    const b = validBundle()
    ;(b.config as unknown as Record<string, unknown>).petVisible = undefined
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('旧备份缺 selectedModel 可兼容（通过）', () => {
    const b = validBundle()
    delete (b.config as unknown as Record<string, unknown>).selectedModel
    expect(validateBackupBundle(b).ok).toBe(true)
  })

  it('selectedModel 非法枚举失败', () => {
    const b = validBundle()
    ;(b.config as unknown as Record<string, unknown>).selectedModel = 'miku'
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('新增角色 mao/wanko/rice 通过 selectedModel 校验', () => {
    for (const id of ['mao', 'wanko', 'rice']) {
      const b = validBundle()
      b.config.selectedModel = id as never
      expect(validateBackupBundle(b).ok).toBe(true)
    }
  })

  // ===== QA 补充边界用例 =====

  it('tasks 非数组失败', () => {
    const b = validBundle()
    ;(b.data as unknown as Record<string, unknown>).tasks = 'not-array'
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('overrides 非数组失败', () => {
    const b = validBundle()
    ;(b.data as unknown as Record<string, unknown>).overrides = null
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('task.date 类型错误（非 null 非 string）失败', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).date = 20250815
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('config.petPosition 缺 x 失败', () => {
    const b = validBundle()
    ;(b.config.petPosition as unknown as Record<string, unknown>).x = undefined
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('backupVersion 非数字失败', () => {
    const b = validBundle()
    ;(b as unknown as Record<string, unknown>).backupVersion = '1'
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('data.version 非数字失败', () => {
    const b = validBundle()
    ;(b.data as unknown as Record<string, unknown>).version = '1'
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('pomodoroFocusMinutes 类型错误失败', () => {
    const b = validBundle()
    ;(b.config as unknown as Record<string, unknown>).pomodoroFocusMinutes = '25'
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('overrides 数组元素非对象失败', () => {
    const b = validBundle()
    b.data.overrides = ['oops'] as never
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  // ===== 加固：createdAt/updatedAt/repeat/可选字段/version 值 =====

  it('缺 createdAt 失败', () => {
    const b = validBundle()
    delete (b.data.tasks[0] as unknown as Record<string, unknown>).createdAt
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('缺 updatedAt 失败', () => {
    const b = validBundle()
    delete (b.data.tasks[0] as unknown as Record<string, unknown>).updatedAt
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('repeat.type 非法枚举失败', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as { repeat: unknown }).repeat = { type: 'hourly', interval: 1 }
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('repeat.interval 类型错失败', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as { repeat: unknown }).repeat = { type: 'daily', interval: '1' }
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('inboxOrder 类型错失败', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).inboxOrder = 'top'
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('completedAt 类型错失败', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).completedAt = 123
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('旧任务缺 category/color 可兼容（通过）', () => {
    const b = validBundle()
    expect(validateBackupBundle(b).ok).toBe(true)
  })

  it('category 类型错失败', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).category = 123
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('color 类型错失败', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).color = ['#fff']
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('backupVersion 值非当前版本失败', () => {
    const b = validBundle()
    ;(b as unknown as Record<string, unknown>).backupVersion = 2
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('data.version 值非当前版本失败', () => {
    const b = validBundle()
    ;(b.data as unknown as Record<string, unknown>).version = 99
    expect(validateBackupBundle(b).ok).toBe(false)
  })
})

describe('第四批新增字段兼容与校验', () => {
  it('旧备份缺 goals/habits 可兼容（通过）', () => {
    const b = validBundle()
    delete (b.data as unknown as Record<string, unknown>).goals
    delete (b.data as unknown as Record<string, unknown>).habits
    expect(validateBackupBundle(b).ok).toBe(true)
  })

  it('goals/habits 合法通过', () => {
    const b = validBundle()
    b.data.goals = [{ id: 'g1', title: '考试', targetDate: '2025-12-01', createdAt: '2025-08-15T00:00:00.000Z' }]
    b.data.habits = [{ id: 'h1', title: '喝水', checkins: ['2025-08-15'] }]
    const res = validateBackupBundle(b)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.goals.length).toBe(1)
      expect(res.data.habits.length).toBe(1)
    }
  })

  it('goals 非数组失败', () => {
    const b = validBundle()
    ;(b.data as unknown as Record<string, unknown>).goals = 'not-array'
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('habits.checkins 非数组失败', () => {
    const b = validBundle()
    b.data.habits = [{ id: 'h1', title: '喝水', checkins: '2025-08-15' }] as never
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('task.startTime/durationSec 类型错失败', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).startTime = 900
    expect(validateBackupBundle(b).ok).toBe(false)
    const b2 = validBundle()
    ;(b2.data.tasks[0] as unknown as Record<string, unknown>).durationSec = '60'
    expect(validateBackupBundle(b2).ok).toBe(false)
  })

  it('task.startTime/endTime/durationSec 合法通过', () => {
    const b = validBundle()
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).startTime = '09:00'
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).endTime = '10:00'
    ;(b.data.tasks[0] as unknown as Record<string, unknown>).durationSec = 3600
    expect(validateBackupBundle(b).ok).toBe(true)
  })

  it('config 新增备注字段缺省通过 / 类型错失败', () => {
    const b = validBundle()
    delete (b.config as unknown as Record<string, unknown>).showNotesInCalendar
    delete (b.config as unknown as Record<string, unknown>).noteTruncateLength
    expect(validateBackupBundle(b).ok).toBe(true)

    const b2 = validBundle()
    ;(b2.config as unknown as Record<string, unknown>).noteTruncateLength = '30'
    expect(validateBackupBundle(b2).ok).toBe(false)
  })
})

describe('第五批新增字段兼容与校验', () => {
  it('goal.category/color 合法通过并回填默认', () => {
    const b = validBundle()
    b.data.goals = [
      { id: 'g1', title: '考试', targetDate: '2025-12-01', createdAt: '2025-08-15T00:00:00.000Z', category: '学习', color: '#3b82f6' },
    ]
    const res = validateBackupBundle(b)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.goals[0].category).toBe('学习')
      expect(res.data.goals[0].color).toBe('#3b82f6')
    }
  })

  it('goal.category/color 缺省兼容（回填空字符串）', () => {
    const b = validBundle()
    b.data.goals = [{ id: 'g1', title: '考试', targetDate: '2025-12-01', createdAt: '2025-08-15T00:00:00.000Z' }]
    const res = validateBackupBundle(b)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.goals[0].category).toBe('')
      expect(res.data.goals[0].color).toBe('')
    }
  })

  it('goal.category 类型错失败', () => {
    const b = validBundle()
    b.data.goals = [{ id: 'g1', title: '考试', targetDate: '2025-12-01', createdAt: '2025-08-15T00:00:00.000Z', category: 123 }] as never
    expect(validateBackupBundle(b).ok).toBe(false)
  })

  it('habit.archived 合法通过', () => {
    const b = validBundle()
    b.data.habits = [{ id: 'h1', title: '喝水', checkins: [], archived: true }]
    const res = validateBackupBundle(b)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.habits[0].archived).toBe(true)
  })

  it('habit.archived 缺省兼容（回填 false）', () => {
    const b = validBundle()
    b.data.habits = [{ id: 'h1', title: '喝水', checkins: [] }]
    const res = validateBackupBundle(b)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.habits[0].archived).toBe(false)
  })

  it('habit.archived 类型错失败', () => {
    const b = validBundle()
    b.data.habits = [{ id: 'h1', title: '喝水', checkins: [], archived: 'yes' }] as never
    expect(validateBackupBundle(b).ok).toBe(false)
  })
})
