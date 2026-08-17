/**
 * 数据类 IPC handler：task / override / config / collection（v3）/ 批量操作。
 * 所有写操作在 main 侧完成「内存快照更新 + 原子写文件」，返回最新对象给渲染进程。
 * v3：任务写操作同步追加时间轴流水（activities），供时间轴页面回看。
 */
import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { store } from './store'
import { getMainWindow } from './windows'
import { IPC, IPC_MAIN } from '../shared/ipc-channels'
import { applyFocusClearRange, applyFocusCommit, applyFocusDelete, applyFocusReset } from '../shared/focus'
import { applyTaskStatus, shiftRepeatOnMove } from '../shared/taskOps'
import { appendActivity, INBOX_ID } from '../shared/collections'
import type {
  AppConfig,
  CountdownGoal,
  CreateTaskInput,
  FocusCommitResult,
  FocusSession,
  FullData,
  OverrideAction,
  RepeatOverride,
  Task,
  TaskCollection,
  TaskStatus,
} from '../shared/types'

function nowIso(): string {
  return new Date().toISOString()
}

/** 计算收集箱下一个排序权重 */
function nextInboxOrder(data: FullData): number {
  const orders = data.tasks
    .filter((t) => t.date === null && t.inboxOrder != null)
    .map((t) => t.inboxOrder as number)
  return orders.length > 0 ? Math.max(...orders) + 1 : 0
}

/** 追加时间轴流水并落盘（写操作统一入口，标题为操作前快照） */
function logActivity(
  data: FullData,
  type: 'create' | 'complete' | 'reopen' | 'delete' | 'timer' | 'move' | 'edit' | 'checkin',
  taskTitle: string,
  detail?: string,
): void {
  data.activities = appendActivity(data.activities, { type, taskTitle, detail })
}

/** 集合名称查找（活动日志「移入 xx」用） */
function collectionName(data: FullData, id: string | undefined): string {
  if (!id || id === INBOX_ID) return '收集箱'
  return data.collections.find((c) => c.id === id)?.name ?? '收集箱'
}

export function registerDataIpc(): void {
  ipcMain.handle(IPC.dataLoad, (): FullData => store.getData())

  // 专注原子提交：applyFocusCommit 纯函数一次 setData 写入「会话 + 任务用时」，
  // 避免两条独立 IPC 中途失败造成 durationSec 与 sessions 漂移（QA O1）
  ipcMain.handle(IPC.focusCommit, (_event, session: FocusSession): FocusCommitResult => {
    const data = store.getData()
    const title = data.tasks.find((t) => t.id === session.taskId)?.title ?? '自由计时'
    const applied = applyFocusCommit(data, session)
    if (session.taskId && session.durationSec > 0) {
      logActivity(applied, 'timer', title, `专注 ${Math.round(session.durationSec / 60)} 分钟`)
    }
    store.setData(applied)
    return { task: applied.tasks.find((t) => t.id === session.taskId) ?? null }
  })

  // 统计数据清除三件套（单条 / 指定周期 / 全部重置）：
  // 纯函数一次 setData 落盘，返回最新全量数据供渲染进程各 store 同步刷新
  ipcMain.handle(IPC.statsDeleteSession, (_event, sessionId: string): FullData => {
    const data = applyFocusDelete(store.getData(), sessionId)
    store.setData(data)
    return data
  })

  ipcMain.handle(
    IPC.statsClearRange,
    (_event, payload: { from: string; to: string }): FullData => {
      const data = applyFocusClearRange(store.getData(), payload.from, payload.to)
      store.setData(data)
      return data
    },
  )

  ipcMain.handle(IPC.statsResetAll, (): FullData => {
    const data = applyFocusReset(store.getData())
    store.setData(data)
    return data
  })

  ipcMain.handle(IPC.taskCreate, (_event, input: CreateTaskInput): Task => {
    const data = store.getData()
    const now = nowIso()
    const task: Task = {
      id: randomUUID(),
      title: String(input.title ?? '').trim(),
      description: input.description ?? '',
      priority: input.priority,
      date: input.date,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      repeat: input.repeat ?? null,
      inboxOrder: input.date === null ? nextInboxOrder(data) : null,
      tags: [],
      category: input.category?.trim() ?? '',
      color: input.color?.trim() ?? '',
      startTime: input.startTime || undefined,
      endTime: input.endTime || undefined,
      reminder: input.reminder ?? null,
      taskType: input.taskType ?? 'normal',
      collectionId: input.collectionId ?? INBOX_ID,
      habitCheckins: [],
      timerKind: (input.taskType === 'goal' ? 'none' : input.countdownSec ? 'countdown' : 'stopwatch') as Task['timerKind'],
      countdownSec: input.countdownSec,
    }
    data.tasks.push(task)
    logActivity(data, 'create', task.title, collectionName(data, task.collectionId))
    store.setData(data)
    return task
  })

  ipcMain.handle(IPC.taskUpdate, (_event, payload: { id: string; patch: Partial<Task> }): Task => {
    const data = store.getData()
    const idx = data.tasks.findIndex((t) => t.id === payload.id)
    if (idx === -1) throw new Error(`任务不存在：${payload.id}`)
    const prev = data.tasks[idx]
    const merged: Task = { ...prev, ...payload.patch, id: prev.id, updatedAt: nowIso() }
    data.tasks[idx] = merged
    // 标题/内容类修改记一条 edit 流水（状态变化走 setStatus，不在此重复记录）
    if (payload.patch.title !== undefined && payload.patch.title !== prev.title) {
      logActivity(data, 'edit', merged.title)
    }
    // 目标任务进度调整：记录进度流水
    if (patchProgressChanged(prev, merged)) {
      logActivity(data, 'edit', merged.title, `进度 ${Math.round(merged.progressValue ?? 0)}%`)
    }
    // 习惯打卡：habitCheckins 变化记 checkin 流水
    if (patchCheckinChanged(prev, merged)) {
      logActivity(data, 'checkin', merged.title, '完成今日打卡')
    }
    store.setData(data)
    return merged
  })

  ipcMain.handle(IPC.taskDelete, (_event, id: string): void => {
    const data = store.getData()
    const task = data.tasks.find((t) => t.id === id)
    data.tasks = data.tasks.filter((t) => t.id !== id)
    data.overrides = data.overrides.filter((o) => o.taskId !== id)
    if (task) logActivity(data, 'delete', task.title)
    store.setData(data)
  })

  ipcMain.handle(IPC.taskMove, (_event, payload: { id: string; date: string | null }): Task => {
    const data = store.getData()
    const idx = data.tasks.findIndex((t) => t.id === payload.id)
    if (idx === -1) throw new Error(`任务不存在：${payload.id}`)
    const prev = data.tasks[idx]
    const moved: Task = {
      // 重复任务拖动 = 系列整体平移：endDate 随 anchor 平移，否则 anchor 越过 endDate
      // 后整个系列从日历消失（新位置也不显示），修复「拖出范围后任务全部消失」
      ...shiftRepeatOnMove(prev, payload.date ?? prev.date ?? ''),
      date: payload.date,
      inboxOrder: payload.date === null ? (prev.inboxOrder ?? nextInboxOrder(data)) : null,
      updatedAt: nowIso(),
    }
    data.tasks[idx] = moved
    // anchor 平移：清空该 taskId 的所有 overrides，避免旧日期的 done/skipped 成为孤儿数据
    data.overrides = data.overrides.filter((o) => o.taskId !== payload.id)
    store.setData(data)
    return moved
  })

  ipcMain.handle(IPC.taskSetStatus, (_event, payload: { id: string; status: TaskStatus }): Task => {
    const data = store.getData()
    const idx = data.tasks.findIndex((t) => t.id === payload.id)
    if (idx === -1) throw new Error(`任务不存在：${payload.id}`)
    // completedAt 语义 = 最后一次完成：回到 pending/abandoned 时清空（QA O4）
    const prev = data.tasks[idx]
    const next = applyTaskStatus(data.tasks[idx], payload.status, nowIso())
    data.tasks[idx] = next
    if (prev.status !== 'done' && payload.status === 'done') {
      logActivity(data, 'complete', next.title)
    } else if (prev.status === 'done' && payload.status === 'pending') {
      logActivity(data, 'reopen', next.title)
    }
    store.setData(data)
    return next
  })

  ipcMain.handle(IPC.taskReorderInbox, (_event, orderedIds: string[]): void => {
    const data = store.getData()
    const orderMap = new Map<string, number>()
    orderedIds.forEach((id, index) => orderMap.set(id, index))
    for (const t of data.tasks) {
      if (t.date === null && orderMap.has(t.id)) {
        t.inboxOrder = orderMap.get(t.id) as number
      }
    }
    store.setData(data)
  })

  ipcMain.handle(
    IPC.overrideSet,
    (_event, payload: { taskId: string; occurrenceDate: string; action: OverrideAction }): RepeatOverride => {
      const data = store.getData()
      const existing = data.overrides.find(
        (o) => o.taskId === payload.taskId && o.occurrenceDate === payload.occurrenceDate,
      )
      if (existing) {
        existing.action = payload.action
        store.setData(data)
        return existing
      }
      const ov: RepeatOverride = {
        id: randomUUID(),
        taskId: payload.taskId,
        occurrenceDate: payload.occurrenceDate,
        action: payload.action,
      }
      data.overrides.push(ov)
      store.setData(data)
      return ov
    },
  )

  ipcMain.handle(IPC.overrideClear, (_event, payload: { taskId: string; occurrenceDate: string }): void => {
    const data = store.getData()
    data.overrides = data.overrides.filter(
      (o) => !(o.taskId === payload.taskId && o.occurrenceDate === payload.occurrenceDate),
    )
    store.setData(data)
  })

  // ============ v3 待办集 CRUD ============

  ipcMain.handle(IPC.collectionCreate, (_event, input: { name: string }): TaskCollection => {
    const data = store.getData()
    const name = String(input.name ?? '').trim()
    if (!name) throw new Error('待办集名称不能为空')
    const collection: TaskCollection = {
      id: randomUUID(),
      name,
      isSystem: false,
      sortOrder: data.collections.length,
      createdAt: nowIso(),
    }
    data.collections.push(collection)
    store.setData(data)
    return collection
  })

  ipcMain.handle(IPC.collectionRename, (_event, payload: { id: string; name: string }): TaskCollection => {
    const data = store.getData()
    const collection = data.collections.find((c) => c.id === payload.id)
    if (!collection) throw new Error(`待办集不存在：${payload.id}`)
    if (collection.isSystem) throw new Error('系统收集箱不可重命名')
    const name = String(payload.name ?? '').trim()
    if (!name) throw new Error('待办集名称不能为空')
    collection.name = name
    store.setData(data)
    return collection
  })

  ipcMain.handle(IPC.collectionDelete, (_event, id: string): FullData => {
    const data = store.getData()
    const collection = data.collections.find((c) => c.id === id)
    if (!collection) throw new Error(`待办集不存在：${id}`)
    if (collection.isSystem) throw new Error('系统收集箱不可删除')
    // 内部任务自动回流收集箱，数据不丢失
    let moved = 0
    for (const t of data.tasks) {
      if ((t.collectionId ?? INBOX_ID) === id) {
        t.collectionId = INBOX_ID
        t.updatedAt = nowIso()
        moved += 1
      }
    }
    data.collections = data.collections.filter((c) => c.id !== id)
    logActivity(data, 'move', collection.name, `删除待办集，${moved} 项任务回流收集箱`)
    store.setData(data)
    return data
  })

  ipcMain.handle(IPC.collectionReorder, (_event, orderedIds: string[]): void => {
    const data = store.getData()
    const orderMap = new Map<string, number>()
    orderedIds.forEach((id, index) => orderMap.set(id, index + 1))
    for (const c of data.collections) {
      if (!c.isSystem && orderMap.has(c.id)) {
        c.sortOrder = orderMap.get(c.id) as number
      }
    }
    store.setData(data)
  })

  // ============ v3 任务批量操作 ============

  ipcMain.handle(IPC.taskBatchMove, (_event, payload: { taskIds: string[]; collectionId: string }): FullData => {
    const data = store.getData()
    const targetId = payload.collectionId || INBOX_ID
    const ids = new Set(payload.taskIds ?? [])
    const targetName = collectionName(data, targetId)
    const titles: string[] = []
    for (const t of data.tasks) {
      if (ids.has(t.id) && (t.collectionId ?? INBOX_ID) !== targetId) {
        titles.push(t.title)
        t.collectionId = targetId
        t.updatedAt = nowIso()
      }
    }
    if (titles.length > 0) {
      logActivity(data, 'move', titles[0], titles.length > 1 ? `等 ${titles.length} 项移入 ${targetName}` : `移入 ${targetName}`)
    }
    store.setData(data)
    return data
  })

  ipcMain.handle(IPC.taskBatchStatus, (_event, payload: { taskIds: string[]; status: TaskStatus }): FullData => {
    const data = store.getData()
    const ids = new Set(payload.taskIds ?? [])
    for (const t of data.tasks) {
      if (ids.has(t.id)) {
        const prevStatus = t.status
        data.tasks[data.tasks.indexOf(t)] = applyTaskStatus(t, payload.status, nowIso())
        if (prevStatus !== 'done' && payload.status === 'done') {
          logActivity(data, 'complete', t.title)
        } else if (prevStatus === 'done' && payload.status === 'pending') {
          logActivity(data, 'reopen', t.title)
        }
      }
    }
    store.setData(data)
    return data
  })

  ipcMain.handle(IPC.taskBatchDelete, (_event, taskIds: string[]): FullData => {
    const data = store.getData()
    const ids = new Set(taskIds ?? [])
    for (const t of data.tasks) {
      if (ids.has(t.id)) logActivity(data, 'delete', t.title)
    }
    data.tasks = data.tasks.filter((t) => !ids.has(t.id))
    data.overrides = data.overrides.filter((o) => !ids.has(o.taskId))
    store.setData(data)
    return data
  })

  ipcMain.handle(IPC.configGet, (): AppConfig => store.getConfig())

  ipcMain.handle(IPC.configSet, (_event, patch: Partial<AppConfig>): AppConfig => {
    const cfg = store.setConfig(patch, { debounce: true })
    // 广播配置变更：任一窗口（主窗口/桌宠端）写配置后，主窗口 configStore 同步刷新，
    // 保证桌宠显隐等跨入口状态永远同源
    getMainWindow()?.webContents.send(IPC_MAIN.configChanged, cfg)
    return cfg
  })

  ipcMain.handle(
    IPC.goalCreate,
    (_event, input: { title: string; targetDate: string; category?: string; color?: string }): CountdownGoal => {
      const data = store.getData()
      const goal: CountdownGoal = {
        id: randomUUID(),
        title: String(input.title ?? '').trim(),
        targetDate: String(input.targetDate ?? ''),
        createdAt: nowIso(),
        category: typeof input.category === 'string' ? input.category.trim() : '',
        color: typeof input.color === 'string' ? input.color.trim() : '',
      }
      data.goals.push(goal)
      store.setData(data)
      return goal
    },
  )

  ipcMain.handle(IPC.goalDelete, (_event, id: string): void => {
    const data = store.getData()
    data.goals = data.goals.filter((g) => g.id !== id)
    store.setData(data)
  })
}

/** 目标任务进度是否发生变化（edit 流水判定） */
function patchProgressChanged(prev: Task, next: Task): boolean {
  return (next.progressValue ?? 0) !== (prev.progressValue ?? 0) && next.taskType === 'goal'
}

/** 习惯打卡日期列表是否发生变化（checkin 流水判定） */
function patchCheckinChanged(prev: Task, next: Task): boolean {
  const a = prev.habitCheckins ?? []
  const b = next.habitCheckins ?? []
  return a.length !== b.length || b.some((d) => !a.includes(d))
}
