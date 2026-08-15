/**
 * 倒数日目标 store。数据权威源在 main，经 services/ipc 单向同步。
 */
import { create } from 'zustand'
import type { CountdownGoal } from '../../../shared/types'
import * as api from '../services/ipc'

interface GoalState {
  goals: CountdownGoal[]
  loaded: boolean
  load: () => Promise<void>
  create: (title: string, targetDate: string, category?: string, color?: string) => Promise<CountdownGoal>
  remove: (id: string) => Promise<void>
}

export const useGoalStore = create<GoalState>((set) => ({
  goals: [],
  loaded: false,

  load: async () => {
    const data = await api.loadData()
    set({ goals: data.goals ?? [], loaded: true })
  },

  create: async (title, targetDate, category, color) => {
    const goal = await api.createGoal({ title, targetDate, category, color })
    set((s) => ({ goals: [...s.goals, goal] }))
    return goal
  },

  remove: async (id) => {
    await api.deleteGoal(id)
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
  },
}))
