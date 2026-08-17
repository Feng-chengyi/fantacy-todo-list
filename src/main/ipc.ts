/**
 * 数据类 IPC handler：task / override / config。
 * 所有写操作在 main 侧完成「内存快照更新 + 原子写文件」，返回最新对象给渲染进程。
 */
import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { store } from './store'
import { getMainWindow } from './windows'
import { IPC, IPC_MAIN } from '../shared/ipc-channels'
import { applyFocusClearRange, applyFocusCommit, applyFocusDelete, applyFocusReset } from '../shared/focus'
import { applyTaskStatus, shiftRepeatOnMove } from '../shared/taskOps'
import { normalizeHabit } from '../shared/habit'
import type {
  AppConfig,
  CountdownGoal,
  CreateTaskInput,
  FocusCommitResult,
  FocusSession,
  FullData,
  Habit,
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

  // 专注原子提交：applyFocusCommit 纯函数一次 setData 写入「会话 + 任务用时」，
  // 避免两条独立 IPC 中途失败造成 durationSec 与 sessions 漂移（QA O1）
  ipcMain.handle(IPC.focusCommit, (_event, session: FocusSession): FocusCommitResult => {
    const data = applyFocusCommit(store.getData(), session)
    store.setData(data)
    return { task: data.tasks.find((t) => t.id === session.taskId) ?? null }
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
    const next = applyTaskStatus(data.tasks[idx], payload.status, nowIso())
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

  ipcMain.handle(IPC.habitCreate, (_event, input: { title: string }): Habit => {
    const data = store.getData()
    // normalizeHabit 统一补全 archived，保证返回值与磁盘口径一致（QA Bug 5）
    const habit = normalizeHabit({
      id: randomUUID(),
      title: String(input.title ?? '').trim(),
      checkins: [],
    })
    data.habits.push(habit)
    store.setData(data)
    return habit
  })

  ipcMain.handle(IPC.habitDelete, (_event, id: string): void => {
    const data = store.getData()
    data.habits = data.habits.filter((h) => h.id !== id)
    store.setData(data)
  })

  ipcMain.handle(IPC.habitToggle, (_event, payload: { id: string; date: string }): Habit => {
    const data = store.getData()
    const habit = data.habits.find((h) => h.id === payload.id)
    if (!habit) throw new Error(`习惯不存在：${payload.id}`)
    if (habit.checkins.includes(payload.date)) {
      habit.checkins = habit.checkins.filter((d) => d !== payload.date)
    } else {
      habit.checkins.push(payload.date)
    }
    store.setData(data)
    return habit
  })

  ipcMain.handle(IPC.habitSetArchived, (_event, payload: { id: string; archived: boolean }): Habit => {
    const data = store.getData()
    const habit = data.habits.find((h) => h.id === payload.id)
    if (!habit) throw new Error(`习惯不存在：${payload.id}`)
    habit.archived = payload.archived === true
    store.setData(data)
    return habit
  })
}
