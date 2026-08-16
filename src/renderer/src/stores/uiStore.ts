/**
 * UI 状态 store：当前年月、选中日期、编辑弹窗、筛选、拖拽态、右键菜单。
 */
import { create } from 'zustand'
import type { Task } from '../../../shared/types'
import { addDays, currentYearMonth, shiftMonth, todayStr } from '../../../shared/date'

export type TaskFilter = 'all' | 'pending' | 'done' | 'abandoned'
export type CalendarView = 'month' | 'week' | 'day' | 'list'

/**
 * 正向计时器状态（进行中的秒表，不跨端持久化）。
 * elapsed = accumMs + (paused ? 0 : now - startedAt)；paused 时 startedAt 无效。
 */
export interface TimerState {
  /** 绑定的任务 ID；空字符串 = 自由计时（未绑定任务） */
  taskId: string
  /** 当前段起始毫秒时间戳（Date.now()） */
  startedAt: number
  /** 会话最初开始时刻（暂停/继续不重置，用于生成 FocusSession.startedAt） */
  beginAt: number
  /** 暂停前累计毫秒 */
  accumMs: number
  paused: boolean
}

/** 计算当前已计时的毫秒数（纯函数，供各处展示复用） */
export function timerElapsedMs(t: TimerState): number {
  return t.accumMs + (t.paused ? 0 : Date.now() - t.startedAt)
}

export interface EditorState {
  /** null = 新建；否则为编辑已有任务 */
  task: Task | null
  /** 新建时预填日期；编辑收集箱项为 null */
  date: string | null
  /** 编辑重复任务某个具体实例的日期（单日操作上下文） */
  occurrenceDate?: string
}

export interface ContextMenuState {
  task: Task
  occurrenceDate?: string
  x: number
  y: number
}

interface UiState {
  currentYear: number
  currentMonth: number // 0-based
  selectedDate: string | null
  view: CalendarView
  editor: EditorState | null
  filter: TaskFilter
  showSettings: boolean
  showInbox: boolean
  showStats: boolean
  showPomodoro: boolean
  showHabits: boolean
  showGoals: boolean
  showTimer: boolean
  dragOverDate: string | null
  contextMenu: ContextMenuState | null
  /** 正向计时：当前正在计时的任务 */
  timer: TimerState | null
  goToday: () => void
  nextMonth: () => void
  prevMonth: () => void
  setSelectedDate: (d: string | null) => void
  setView: (v: CalendarView) => void
  prevWeek: () => void
  nextWeek: () => void
  prevDay: () => void
  nextDay: () => void
  openCreate: (date: string | null) => void
  openEdit: (task: Task, occurrenceDate?: string) => void
  closeEditor: () => void
  setFilter: (f: TaskFilter) => void
  setShowSettings: (v: boolean) => void
  setShowInbox: (v: boolean) => void
  setShowStats: (v: boolean) => void
  setShowPomodoro: (v: boolean) => void
  setShowHabits: (v: boolean) => void
  setShowGoals: (v: boolean) => void
  setShowTimer: (v: boolean) => void
  /** 打开计时面板并关闭其它主视图面板（供任务计时按钮「定向」复用） */
  openTimerPanel: () => void
  setDragOverDate: (d: string | null) => void
  setContextMenu: (m: ContextMenuState | null) => void
  startTimer: (taskId: string) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => void
}

const initial = currentYearMonth()

export const useUiStore = create<UiState>((set) => ({
  currentYear: initial.year,
  currentMonth: initial.month,
  selectedDate: todayStr(),
  view: 'month',
  editor: null,
  filter: 'all',
  showSettings: false,
  showInbox: false,
  showStats: false,
  showPomodoro: false,
  showHabits: false,
  showGoals: false,
  showTimer: false,
  dragOverDate: null,
  contextMenu: null,
  timer: null,

  goToday: () => {
    const { year, month } = currentYearMonth()
    set({ currentYear: year, currentMonth: month, selectedDate: todayStr() })
  },

  nextMonth: () =>
    set((s) => {
      const { year, month } = shiftMonth(s.currentYear, s.currentMonth, 1)
      return { currentYear: year, currentMonth: month }
    }),

  prevMonth: () =>
    set((s) => {
      const { year, month } = shiftMonth(s.currentYear, s.currentMonth, -1)
      return { currentYear: year, currentMonth: month }
    }),

  setSelectedDate: (d) => set({ selectedDate: d }),

  setView: (v) => set({ view: v }),

  prevWeek: () => set((s) => ({ selectedDate: s.selectedDate ? addDays(s.selectedDate, -7) : todayStr() })),

  nextWeek: () => set((s) => ({ selectedDate: s.selectedDate ? addDays(s.selectedDate, 7) : todayStr() })),

  prevDay: () => set((s) => ({ selectedDate: s.selectedDate ? addDays(s.selectedDate, -1) : todayStr() })),

  nextDay: () => set((s) => ({ selectedDate: s.selectedDate ? addDays(s.selectedDate, 1) : todayStr() })),

  openCreate: (date) => set({ editor: { task: null, date }, contextMenu: null }),

  openEdit: (task, occurrenceDate) =>
    set({ editor: { task, date: task.date, occurrenceDate }, contextMenu: null }),

  closeEditor: () => set({ editor: null }),

  setFilter: (f) => set({ filter: f }),

  setShowSettings: (v) => set({ showSettings: v }),

  setShowInbox: (v) => set({ showInbox: v }),

  setShowStats: (v) => set({ showStats: v }),

  setShowPomodoro: (v) => set({ showPomodoro: v }),

  setShowHabits: (v) => set({ showHabits: v }),

  setShowGoals: (v) => set({ showGoals: v }),

  setShowTimer: (v) => set({ showTimer: v }),

  openTimerPanel: () =>
    set({ showInbox: false, showStats: false, showHabits: false, showGoals: false, showTimer: true }),

  setDragOverDate: (d) => set({ dragOverDate: d }),

  setContextMenu: (m) => set({ contextMenu: m }),

  startTimer: (taskId) =>
    set({ timer: { taskId, startedAt: Date.now(), beginAt: Date.now(), accumMs: 0, paused: false } }),

  pauseTimer: () =>
    set((s) => {
      if (!s.timer || s.timer.paused) return s
      return {
        timer: {
          ...s.timer,
          accumMs: timerElapsedMs(s.timer),
          paused: true,
        },
      }
    }),

  resumeTimer: () =>
    set((s) => {
      if (!s.timer || !s.timer.paused) return s
      return { timer: { ...s.timer, startedAt: Date.now(), paused: false } }
    }),

  stopTimer: () => set({ timer: null }),
}))
