/**
 * 习惯打卡 store。数据权威源在 main，经 services/ipc 单向同步。
 */
import { create } from 'zustand'
import type { FullData, Habit } from '../../../shared/types'
import * as api from '../services/ipc'

interface HabitState {
  habits: Habit[]
  loaded: boolean
  /** 应用一份已加载的全量数据（loadData 一次往返后由各 store 分发共用，QA O3） */
  applyData: (data: FullData) => void
  load: () => Promise<void>
  create: (title: string) => Promise<Habit>
  remove: (id: string) => Promise<void>
  toggle: (id: string, date: string) => Promise<Habit>
  setArchived: (id: string, archived: boolean) => Promise<Habit>
}

export const useHabitStore = create<HabitState>((set) => ({
  habits: [],
  loaded: false,

  applyData: (data) => set({ habits: data.habits ?? [], loaded: true }),

  load: async () => {
    const data = await api.loadData()
    set({ habits: data.habits ?? [], loaded: true })
  },

  create: async (title) => {
    const habit = await api.createHabit({ title })
    set((s) => ({ habits: [...s.habits, habit] }))
    return habit
  },

  remove: async (id) => {
    await api.deleteHabit(id)
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }))
  },

  toggle: async (id, date) => {
    const habit = await api.toggleHabit(id, date)
    set((s) => ({ habits: s.habits.map((h) => (h.id === id ? habit : h)) }))
    return habit
  },

  setArchived: async (id, archived) => {
    const habit = await api.setHabitArchived(id, archived)
    set((s) => ({ habits: s.habits.map((h) => (h.id === id ? habit : h)) }))
    return habit
  },
}))
