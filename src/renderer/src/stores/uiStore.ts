/**
 * UI 状态 store：当前页面、编辑弹窗、筛选、拖拽态、右键菜单、进行中计时器。
 * v3：一级导航仅 待办/待办集/时间轴/统计/倒数日；计时无独立页面（悬浮窗常驻）。
 */
import { create } from 'zustand'
import type { Task, TaskType, TimerState } from '../../../shared/types'
import { timerElapsedMs } from '../../../shared/focus'
import { addDays, currentYearMonth, shiftMonth, todayStr } from '../../../shared/date'

// 正向计时纯函数与状态类型已迁入 shared（focus.ts / types.ts），此处保留再导出
// 以兼容存量 renderer 引用（TopBar / Stopwatch / services/focus）。
export { timerElapsedMs }
export type { TimerState }

export type TaskFilter = 'all' | 'pending' | 'done' | 'abandoned'
export type CalendarView = 'month' | 'week' | 'day' | 'list'
/** 任务类型筛选（待办页顶部 tab） */
export type TaskTypeFilter = 'all' | TaskType

/** 左侧一级导航页面（v3：5 个核心入口，待办为默认首页） */
export type Page = 'todo' | 'collections' | 'timeline' | 'stats' | 'goals'

export interface EditorState {
  /** null = 新建；否则为编辑已有任务 */
  task: Task | null
  /** 新建时预填日期；无日期任务为 null */
  date: string | null
  /** 编辑重复任务某个具体实例的日期（单日操作上下文） */
  occurrenceDate?: string
  /** v3 新建预设：所属待办集（待办集详情页新建时自动归属） */
  collectionId?: string
}

export interface ContextMenuState {
  task: Task
  x: number
  y: number
}

interface UiState {
  currentYear: number
  currentMonth: number // 0-based
  selectedDate: string | null
  view: CalendarView
  /** 当前一级导航页面（默认待办首页） */
  page: Page
  editor: EditorState | null
  /** 状态筛选（待办页） */
  filter: TaskFilter
  /** v3 任务类型筛选（待办页） */
  typeFilter: TaskTypeFilter
  showSettings: boolean
  /** 制作桌宠向导弹层（从设置面板调起） */
  showPetMaker: boolean
  /** 全局搜索弹层（T05） */
  showSearch: boolean
  /** 使用说明面板（T05） */
  showHelp: boolean
  dragOverDate: string | null
  contextMenu: ContextMenuState | null
  /** 正向/倒计时：当前正在计时的任务（悬浮窗常驻，切换页面不中断） */
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
  openCreate: (date: string | null, preset?: { collectionId?: string }) => void
  openEdit: (task: Task, occurrenceDate?: string) => void
  closeEditor: () => void
  setFilter: (f: TaskFilter) => void
  setTypeFilter: (f: TaskTypeFilter) => void
  setShowSettings: (v: boolean) => void
  setShowPetMaker: (v: boolean) => void
  /** 切换一级导航页面 */
  setPage: (p: Page) => void
  setShowSearch: (v: boolean) => void
  setShowHelp: (v: boolean) => void
  setDragOverDate: (d: string | null) => void
  setContextMenu: (m: ContextMenuState | null) => void
  startTimer: (taskId: string, occurrenceDate?: string | null) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => void
  /** 恢复主进程持久化的计时快照（应用启动时） */
  restoreTimer: (timer: TimerState | null) => void
}

const initial = currentYearMonth()

export const useUiStore = create<UiState>((set) => ({
  currentYear: initial.year,
  currentMonth: initial.month,
  selectedDate: todayStr(),
  view: 'month',
  page: 'todo',
  editor: null,
  filter: 'pending',
  typeFilter: 'all',
  showSettings: false,
  showPetMaker: false,
  showSearch: false,
  showHelp: false,
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

  openCreate: (date, preset) =>
    set({ editor: { task: null, date, collectionId: preset?.collectionId }, contextMenu: null }),

  openEdit: (task, occurrenceDate) =>
    set({ editor: { task, date: task.date, occurrenceDate }, contextMenu: null }),

  closeEditor: () => set({ editor: null }),

  setFilter: (f) => set({ filter: f }),

  setTypeFilter: (f) => set({ typeFilter: f }),

  setShowSettings: (v) => set({ showSettings: v }),

  setShowPetMaker: (v) => set({ showPetMaker: v }),

  setPage: (p) => set({ page: p }),

  setShowSearch: (v) => set({ showSearch: v }),

  setShowHelp: (v) => set({ showHelp: v }),

  setDragOverDate: (d) => set({ dragOverDate: d }),

  setContextMenu: (m) => set({ contextMenu: m }),

  startTimer: (taskId, occurrenceDate = null) =>
    set({
      timer: {
        taskId,
        startedAt: Date.now(),
        beginAt: Date.now(),
        accumMs: 0,
        paused: false,
        occurrenceDate: occurrenceDate ?? null,
      },
    }),

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

  restoreTimer: (timer) => set({ timer }),
}))
