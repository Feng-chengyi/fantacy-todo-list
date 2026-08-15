/**
 * UI 状态 store：当前年月、选中日期、编辑弹窗、筛选、拖拽态、右键菜单。
 */
import { create } from 'zustand'
import type { Task } from '../../../shared/types'
import { addDays, currentYearMonth, shiftMonth, todayStr } from '../../../shared/date'

export type TaskFilter = 'all' | 'pending' | 'done' | 'abandoned'
export type CalendarView = 'month' | 'week'

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
  showPomodoro: boolean
  dragOverDate: string | null
  contextMenu: ContextMenuState | null
  goToday: () => void
  nextMonth: () => void
  prevMonth: () => void
  setSelectedDate: (d: string | null) => void
  setView: (v: CalendarView) => void
  prevWeek: () => void
  nextWeek: () => void
  openCreate: (date: string | null) => void
  openEdit: (task: Task, occurrenceDate?: string) => void
  closeEditor: () => void
  setFilter: (f: TaskFilter) => void
  setShowSettings: (v: boolean) => void
  setShowInbox: (v: boolean) => void
  setShowPomodoro: (v: boolean) => void
  setDragOverDate: (d: string | null) => void
  setContextMenu: (m: ContextMenuState | null) => void
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
  showPomodoro: false,
  dragOverDate: null,
  contextMenu: null,

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

  openCreate: (date) => set({ editor: { task: null, date }, contextMenu: null }),

  openEdit: (task, occurrenceDate) =>
    set({ editor: { task, date: task.date, occurrenceDate }, contextMenu: null }),

  closeEditor: () => set({ editor: null }),

  setFilter: (f) => set({ filter: f }),

  setShowSettings: (v) => set({ showSettings: v }),

  setShowInbox: (v) => set({ showInbox: v }),

  setShowPomodoro: (v) => set({ showPomodoro: v }),

  setDragOverDate: (d) => set({ dragOverDate: d }),

  setContextMenu: (m) => set({ contextMenu: m }),
}))
