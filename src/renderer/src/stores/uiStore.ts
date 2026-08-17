/**
 * UI 状态 store：当前年月、选中日期、编辑弹窗、筛选、拖拽态、右键菜单。
 */
import { create } from 'zustand'
import type { Task, TimerMode, TimerState } from '../../../shared/types'
import { timerElapsedMs } from '../../../shared/focus'
import { addDays, currentYearMonth, shiftMonth, todayStr } from '../../../shared/date'

// 正向计时纯函数与状态类型已迁入 shared（focus.ts / types.ts），此处保留再导出
// 以兼容存量 renderer 引用（TopBar / TimerPanel / Stopwatch / services/focus）。
export { timerElapsedMs }
export type { TimerState }

export type TaskFilter = 'all' | 'pending' | 'done' | 'abandoned'
export type CalendarView = 'month' | 'week' | 'day' | 'list'

/** 左侧一级导航页面（待办为默认首页；日历/时间线复盘归入时间轴页） */
export type Page = 'todo' | 'inbox' | 'timeline' | 'stats' | 'habits' | 'goals' | 'timer'

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
  /** 当前一级导航页面（默认待办首页） */
  page: Page
  editor: EditorState | null
  filter: TaskFilter
  showSettings: boolean
  /** 制作桌宠向导弹层（从设置面板调起） */
  showPetMaker: boolean
  /** 全局搜索弹层（T05） */
  showSearch: boolean
  /** 使用说明面板（T05） */
  showHelp: boolean
  /** 计时器模式：正向计时 / 番茄钟（统一计时页切换） */
  timerMode: TimerMode
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
  setShowPetMaker: (v: boolean) => void
  /** 切换一级导航页面 */
  setPage: (p: Page) => void
  setShowSearch: (v: boolean) => void
  setShowHelp: (v: boolean) => void
  setTimerMode: (mode: TimerMode) => void
  /** 打开计时面板并关闭其它主视图面板；传 mode 时同时切换计时器模式（供快捷键/番茄入口复用） */
  openTimerPanel: (mode?: TimerMode) => void
  setDragOverDate: (d: string | null) => void
  setContextMenu: (m: ContextMenuState | null) => void
  startTimer: (taskId: string, occurrenceDate?: string | null) => void
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
  page: 'todo',
  editor: null,
  filter: 'all',
  showSettings: false,
  showPetMaker: false,
  showSearch: false,
  showHelp: false,
  timerMode: 'stopwatch',
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

  setShowPetMaker: (v) => set({ showPetMaker: v }),

  setPage: (p) => set({ page: p }),

  setShowSearch: (v) => set({ showSearch: v }),

  setShowHelp: (v) => set({ showHelp: v }),

  setTimerMode: (mode) => set({ timerMode: mode }),

  openTimerPanel: (mode) =>
    set({
      page: 'timer',
      ...(mode ? { timerMode: mode } : {}),
    }),

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
}))
