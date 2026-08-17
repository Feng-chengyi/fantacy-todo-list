import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_LOG_CAP,
  appendActivity,
  collectionStats,
  ensureCollections,
  habitToTask,
  migrateDataV3,
  INBOX_ID,
} from './collections'
import type { ActivityLog, FullData, Habit, Task } from './types'

function baseTask(patch: Partial<Task>): Task {
  return {
    id: 't1',
    title: '旧任务',
    priority: 'medium',
    date: '2026-08-01',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '',
    tags: [],
    ...patch,
  } as Task
}

function habit(patch: Partial<Habit>): Habit {
  return { id: 'h1', title: '每日阅读', checkins: ['2026-08-15', '2026-08-16'], ...patch }
}

function baseData(patch: Partial<FullData> = {}): FullData {
  return {
    version: 1,
    tasks: [baseTask({})],
    overrides: [],
    goals: [],
    habits: [],
    sessions: [],
    collections: undefined as unknown as FullData['collections'],
    activities: undefined as unknown as FullData['activities'],
    ...patch,
  } as FullData
}

describe('ensureCollections', () => {
  it('空列表兜底为仅含系统收集箱', () => {
    const list = ensureCollections(undefined)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(INBOX_ID)
    expect(list[0].isSystem).toBe(true)
    expect(list[0].sortOrder).toBe(0)
  })

  it('已有收集箱时保留并按 sortOrder 排序，收集箱强制置顶', () => {
    const list = ensureCollections([
      { id: 'c2', name: '工作', isSystem: false, sortOrder: 2, createdAt: '' },
      { id: INBOX_ID, name: '收集箱', isSystem: true, sortOrder: 5, createdAt: '' },
      { id: 'c1', name: '生活', isSystem: false, sortOrder: 1, createdAt: '' },
    ])
    expect(list.map((c) => c.id)).toEqual([INBOX_ID, 'c1', 'c2'])
    expect(list[0].sortOrder).toBe(0)
  })
})

describe('habitToTask', () => {
  it('习惯转换为 taskType=habit 的任务，打卡日期迁移，默认每日重复', () => {
    const t = habitToTask(habit({}))
    expect(t.taskType).toBe('habit')
    expect(t.collectionId).toBe(INBOX_ID)
    expect(t.habitCheckins).toEqual(['2026-08-15', '2026-08-16'])
    expect(t.repeat).toEqual({ type: 'daily', interval: 1 })
    expect(t.status).toBe('pending')
  })

  it('已归档习惯映射为 abandoned 状态', () => {
    const t = habitToTask(habit({ archived: true }))
    expect(t.status).toBe('abandoned')
  })
})

describe('migrateDataV3', () => {
  it('补全 collections / activities；旧任务补全 collectionId / taskType / timerKind', () => {
    const migrated = migrateDataV3(baseData())
    expect(migrated.version).toBeGreaterThanOrEqual(2)
    expect(migrated.collections.some((c) => c.id === INBOX_ID)).toBe(true)
    expect(migrated.activities).toEqual([])
    expect(migrated.tasks[0].collectionId).toBe(INBOX_ID)
    expect(migrated.tasks[0].taskType).toBe('normal')
    expect(migrated.tasks[0].timerKind).toBe('stopwatch')
  })

  it('旧 habits 非空时一次性并入 tasks 并清空 habits；幂等（二次迁移不再重复）', () => {
    const data = baseData({ habits: [habit({})] })
    const once = migrateDataV3(data)
    expect(once.habits).toEqual([])
    const habitTask = once.tasks.find((t) => t.id === 'h1')
    expect(habitTask?.taskType).toBe('habit')
    const twice = migrateDataV3(once)
    expect(twice.tasks.filter((t) => t.id === 'h1')).toHaveLength(1)
  })

  it('保留原有 taskType（不覆盖已迁移数据）', () => {
    const data = baseData({ tasks: [baseTask({ taskType: 'goal', collectionId: 'c1' })] })
    const migrated = migrateDataV3(data)
    expect(migrated.tasks[0].taskType).toBe('goal')
    expect(migrated.tasks[0].collectionId).toBe('c1')
  })
})

describe('collectionStats', () => {
  it('统计单集合任务数 / 完成数 / 完成率 / 累计专注秒数（不含 abandoned）', () => {
    const tasks = [
      baseTask({ id: 'a', collectionId: 'c1', status: 'done' }),
      baseTask({ id: 'b', collectionId: 'c1', status: 'pending' }),
      baseTask({ id: 'c', collectionId: 'c1', status: 'abandoned' }),
      baseTask({ id: 'd', collectionId: INBOX_ID, status: 'done' }),
    ]
    const sessions = [
      { id: 's1', taskId: 'a', startedAt: '', endedAt: '', durationSec: 60 },
      { id: 's2', taskId: 'b', startedAt: '', endedAt: '', durationSec: 30 },
      { id: 's3', taskId: 'd', startedAt: '', endedAt: '', durationSec: 999 },
    ]
    const stats = collectionStats(tasks, sessions, 'c1')
    expect(stats.total).toBe(2)
    expect(stats.done).toBe(1)
    expect(stats.rate).toBeCloseTo(0.5)
    expect(stats.focusSec).toBe(90)
  })
})

describe('appendActivity', () => {
  it('追加流水并自动补 id / createdAt', () => {
    const next = appendActivity([], { type: 'create', taskTitle: '写周报' })
    expect(next).toHaveLength(1)
    expect(next[0].id).toBeTruthy()
    expect(next[0].createdAt).toBeTruthy()
  })

  it('超出上限裁剪最旧记录', () => {
    let list: ActivityLog[] = Array.from({ length: ACTIVITY_LOG_CAP }, (_, i) => ({
      id: `a${i}`,
      type: 'edit' as const,
      taskTitle: `t${i}`,
      createdAt: '',
    }))
    list = appendActivity(list, { type: 'edit', taskTitle: 'new' })
    expect(list).toHaveLength(ACTIVITY_LOG_CAP)
    expect(list[list.length - 1].taskTitle).toBe('new')
    expect(list[0].taskTitle).toBe('t1')
  })
})
