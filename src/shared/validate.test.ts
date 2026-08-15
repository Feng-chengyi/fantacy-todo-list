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
