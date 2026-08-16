/**
 * 任务 + 覆盖状态 store。数据权威源在 main，经 services/ipc 单向同步。
 */
import { create } from 'zustand'
import type {
  CreateTaskInput,
  FocusSession,
  FullData,
  OverrideAction,
  RepeatOverride,
  Task,
  TaskStatus,
} from '../../../shared/types'
import * as api from '../services/ipc'

interface TaskState {
  tasks: Task[]
  overrides: RepeatOverride[]
  /** 专注计时会话记录（统计的权威数据源） */
  sessions: FocusSession[]
  loaded: boolean
  /** 应用一份已加载的全量数据（与 loadData 一次往返后由各 store 分发共用，QA O3） */
  applyData: (data: FullData) => void
  load: () => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (id: string, patch: Partial<Task>) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  moveTask: (id: string, date: string | null) => Promise<Task>
  setStatus: (id: string, status: TaskStatus) => Promise<Task>
  reorderInbox: (orderedIds: string[]) => Promise<void>
  setOverride: (taskId: string, occurrenceDate: string, action: OverrideAction) => Promise<void>
  clearOverride: (taskId: string, occurrenceDate: string) => Promise<void>
  /** 应用一次专注原子提交的本地回放（main 已落盘，返回更新后的任务） */
  applyCommit: (task: Task | null, session: FocusSession) => void
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  overrides: [],
  sessions: [],
  loaded: false,

  applyData: (data) =>
    set({
      tasks: data.tasks,
      overrides: data.overrides,
      sessions: data.sessions ?? [],
      loaded: true,
    }),

  load: async () => {
    const data = await api.loadData()
    set({
      tasks: data.tasks,
      overrides: data.overrides,
      sessions: data.sessions ?? [],
      loaded: true,
    })
  },

  createTask: async (input) => {
    const task = await api.createTask(input)
    set((s) => ({ tasks: [...s.tasks, task] }))
    return task
  },

  updateTask: async (id, patch) => {
    const task = await api.updateTask(id, patch)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? task : t)) }))
    return task
  },

  deleteTask: async (id) => {
    await api.deleteTask(id)
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      overrides: s.overrides.filter((o) => o.taskId !== id),
    }))
  },

  moveTask: async (id, date) => {
    const task = await api.moveTask(id, date)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? task : t)) }))
    return task
  },

  setStatus: async (id, status) => {
    const task = await api.setTaskStatus(id, status)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? task : t)) }))
    return task
  },

  reorderInbox: async (orderedIds) => {
    await api.reorderInbox(orderedIds)
    set((s) => ({
      tasks: s.tasks.map((t) => {
        const idx = orderedIds.indexOf(t.id)
        return t.date === null && idx !== -1 ? { ...t, inboxOrder: idx } : t
      }),
    }))
  },

  setOverride: async (taskId, occurrenceDate, action) => {
    const ov = await api.setOverride(taskId, occurrenceDate, action)
    set((s) => {
      const exists = s.overrides.some((o) => o.id === ov.id)
      const overrides = exists
        ? s.overrides.map((o) => (o.id === ov.id ? ov : o))
        : [...s.overrides, ov]
      return { overrides }
    })
  },

  clearOverride: async (taskId, occurrenceDate) => {
    await api.clearOverride(taskId, occurrenceDate)
    set((s) => ({
      overrides: s.overrides.filter(
        (o) => !(o.taskId === taskId && o.occurrenceDate === occurrenceDate),
      ),
    }))
  },

  applyCommit: (task, session) =>
    set((s) => ({
      tasks: task ? s.tasks.map((t) => (t.id === task.id ? task : t)) : s.tasks,
      sessions: [...s.sessions, session],
    })),
}))
