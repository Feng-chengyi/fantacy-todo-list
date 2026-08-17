/**
 * v3 待办集体系纯函数（无 IO / 无 React，可独立单测）。
 *
 * - 收集箱：系统内置、永久存在、不可删除、不可重命名的默认待办集（INBOX_ID）；
 * - 迁移：旧 habits 数组一次性降格为 taskType='habit' 的任务（打卡日期 → habitCheckins，
 *   archived → status='abandoned'），旧任务补全 collectionId / taskType / timerKind；
 * - 统计：单集合任务数 / 完成数 / 完成率 / 累计专注时长（由 sessions 权威汇总）。
 */
import { INBOX_COLLECTION } from './defaults'
import type { ActivityLog, FocusSession, FullData, Habit, Task, TaskCollection } from './types'

/** 系统收集箱集合 ID（全局固定，禁止修改） */
export const INBOX_ID = 'inbox'

/** 时间轴流水日志保留上限（超出裁剪最旧记录） */
export const ACTIVITY_LOG_CAP = 1000

/** 收集箱（系统内置，唯一实例） */
export function inboxCollection(): TaskCollection {
  return { ...INBOX_COLLECTION, createdAt: new Date().toISOString() }
}

/** 兜底集合列表：至少包含收集箱；收集箱固定 sortOrder=0 置顶 */
export function ensureCollections(collections: TaskCollection[] | undefined): TaskCollection[] {
  const list = Array.isArray(collections) ? collections.filter((c) => c && typeof c.id === 'string') : []
  const hasInbox = list.some((c) => c.id === INBOX_ID)
  const merged = hasInbox ? list : [inboxCollection(), ...list]
  return merged
    .map((c) => ({
      ...c,
      isSystem: c.id === INBOX_ID ? true : c.isSystem === true,
      sortOrder: c.id === INBOX_ID ? 0 : typeof c.sortOrder === 'number' ? c.sortOrder : 1,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
}

/** 旧习惯 → 习惯任务（taskType='habit'，每日重复 + 打卡日期迁移） */
export function habitToTask(habit: Habit): Task {
  const now = new Date().toISOString()
  return {
    id: habit.id,
    title: habit.title,
    description: '',
    priority: 'medium',
    date: null,
    status: habit.archived === true ? 'abandoned' : 'pending',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    repeat: { type: 'daily', interval: 1 },
    inboxOrder: null,
    tags: [],
    category: '',
    color: '',
    reminder: null,
    taskType: 'habit',
    collectionId: INBOX_ID,
    habitCheckins: Array.isArray(habit.checkins) ? [...habit.checkins] : [],
    timerKind: 'stopwatch',
  }
}

/** 旧任务补全 v3 字段（collectionId / taskType / timerKind / habitCheckins） */
export function normalizeTaskV3(task: Task): Task {
  return {
    ...task,
    taskType: task.taskType ?? 'normal',
    collectionId: typeof task.collectionId === 'string' && task.collectionId ? task.collectionId : INBOX_ID,
    timerKind: task.timerKind ?? 'stopwatch',
    habitCheckins: Array.isArray(task.habitCheckins) ? task.habitCheckins : [],
  }
}

/**
 * v2 → v3 数据迁移（幂等）：
 * - 补全 collections（至少收集箱）与 activities 数组；
 * - tasks 补全 v3 字段；
 * - habits 非空时一次性转换并入 tasks，随后清空 habits（不再有独立习惯模块）。
 */
export function migrateDataV3(data: FullData): FullData {
  const collections = ensureCollections(data.collections)
  const tasks = (Array.isArray(data.tasks) ? data.tasks : []).map(normalizeTaskV3)
  const habits = Array.isArray(data.habits) ? data.habits : []
  const migratedTasks = habits.length > 0 ? [...tasks, ...habits.map(habitToTask)] : tasks
  return {
    ...data,
    version: Math.max(data.version ?? 1, 2),
    tasks: migratedTasks,
    habits: [],
    collections,
    activities: Array.isArray(data.activities) ? data.activities : [],
  }
}

/** 单集合统计（不含 abandoned） */
export interface CollectionStats {
  total: number
  done: number
  /** 完成率 0-1（total=0 时为 0） */
  rate: number
  /** 累计专注秒数（sessions 中绑定该集合任务的会话时长汇总） */
  focusSec: number
}

export function collectionStats(
  tasks: Task[],
  sessions: FocusSession[],
  collectionId: string,
): CollectionStats {
  const inCollection = tasks.filter((t) => (t.collectionId ?? INBOX_ID) === collectionId)
  const active = inCollection.filter((t) => t.status !== 'abandoned')
  const done = active.filter((t) => t.status === 'done')
  const ids = new Set(inCollection.map((t) => t.id))
  const focusSec = sessions
    .filter((s) => s.taskId && ids.has(s.taskId))
    .reduce((sum, s) => sum + s.durationSec, 0)
  return {
    total: active.length,
    done: done.length,
    rate: active.length > 0 ? done.length / active.length : 0,
    focusSec,
  }
}

/** 追加一条时间轴流水（裁剪至 ACTIVITY_LOG_CAP，最新在前返回顺序 = 旧→新保持追加序） */
export function appendActivity(
  activities: ActivityLog[],
  entry: Omit<ActivityLog, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): ActivityLog[] {
  const log: ActivityLog = {
    id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: entry.type,
    taskTitle: entry.taskTitle,
    detail: entry.detail,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  }
  const next = [...activities, log]
  return next.length > ACTIVITY_LOG_CAP ? next.slice(next.length - ACTIVITY_LOG_CAP) : next
}
