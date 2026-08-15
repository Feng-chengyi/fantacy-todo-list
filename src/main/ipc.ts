/**
 * 数据类 IPC handler：task / override / config。
 * 所有写操作在 main 侧完成「内存快照更新 + 原子写文件」，返回最新对象给渲染进程。
 */
import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { store } from './store'
import { IPC } from '../shared/ipc-channels'
import type {
  AppConfig,
  CreateTaskInput,
  FullData,
  OverrideAction,
  RepeatOverride,
  Task,
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

export function registerDataIpc(): void {
  ipcMain.handle(IPC.dataLoad, (): FullData => store.getData())

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
    }
    data.tasks.push(task)
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
    store.setData(data)
    return merged
  })

  ipcMain.handle(IPC.taskDelete, (_event, id: string): void => {
    const data = store.getData()
    data.tasks = data.tasks.filter((t) => t.id !== id)
    data.overrides = data.overrides.filter((o) => o.taskId !== id)
    store.setData(data)
  })

  ipcMain.handle(IPC.taskMove, (_event, payload: { id: string; date: string | null }): Task => {
    const data = store.getData()
    const idx = data.tasks.findIndex((t) => t.id === payload.id)
    if (idx === -1) throw new Error(`任务不存在：${payload.id}`)
    const prev = data.tasks[idx]
    const moved: Task = {
      ...prev,
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
    const prev = data.tasks[idx]
    const next: Task = {
      ...prev,
      status: payload.status,
      completedAt: payload.status === 'done' ? nowIso() : (prev.completedAt ?? null),
      updatedAt: nowIso(),
    }
    data.tasks[idx] = next
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

  ipcMain.handle(IPC.configGet, (): AppConfig => store.getConfig())

  ipcMain.handle(IPC.configSet, (_event, patch: Partial<AppConfig>): AppConfig => {
    return store.setConfig(patch, { debounce: true })
  })
}
