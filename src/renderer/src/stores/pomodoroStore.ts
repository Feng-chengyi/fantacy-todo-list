/**
 * 番茄钟状态机（renderer 端，zustand + setInterval）。
 * 专注/休息阶段切换时通过 pet:notify-pomodoro 通知桌宠切换陪伴状态。
 * timer 由 store 模块级持有，start 前先清旧 timer 防泄漏；计时独立于 UI 面板。
 */
import { create } from 'zustand'
import type { PomodoroPhase } from '../../../shared/types'
import * as api from '../services/ipc'

export type PomodoroStatus = 'idle' | 'running'

interface PomodoroStore {
  status: PomodoroStatus
  phase: 'focus' | 'break'
  remainingSeconds: number
  totalSeconds: number
  focusMinutes: number
  breakMinutes: number
  init: (focusMinutes: number, breakMinutes: number) => void
  start: () => void
  pause: () => void
  reset: () => void
  skip: () => void
}

let timerId: number | null = null

function stopTimer(): void {
  if (timerId != null) {
    clearInterval(timerId)
    timerId = null
  }
}

function notify(phase: PomodoroPhase, remainingSeconds: number, totalSeconds: number): void {
  void api.notifyPomodoro({ phase, remainingSeconds, totalSeconds })
}

export const usePomodoroStore = create<PomodoroStore>((set, get) => {
  const startTimer = (): void => {
    stopTimer()
    timerId = window.setInterval(() => {
      const s = get()
      if (s.status !== 'running') return
      const next = s.remainingSeconds - 1
      if (next > 0) {
        set({ remainingSeconds: next })
        return
      }
      // 阶段结束：自动切换
      if (s.phase === 'focus') {
        const total = s.breakMinutes * 60
        set({ phase: 'break', remainingSeconds: total, totalSeconds: total })
        notify('break', total, total)
      } else {
        const total = s.focusMinutes * 60
        set({ phase: 'focus', remainingSeconds: total, totalSeconds: total })
        notify('focus', total, total)
      }
    }, 1000)
  }

  return {
    status: 'idle',
    phase: 'focus',
    remainingSeconds: 25 * 60,
    totalSeconds: 25 * 60,
    focusMinutes: 25,
    breakMinutes: 5,

    init: (focusMinutes, breakMinutes) => {
      const f = Math.max(1, Math.floor(focusMinutes))
      const b = Math.max(1, Math.floor(breakMinutes))
      set((s) => {
        if (s.status === 'idle') {
          return {
            focusMinutes: f,
            breakMinutes: b,
            phase: 'focus' as const,
            remainingSeconds: f * 60,
            totalSeconds: f * 60,
          }
        }
        return { focusMinutes: f, breakMinutes: b }
      })
    },

    start: () => {
      const s = get()
      if (s.status === 'running') return
      set({ status: 'running' })
      notify(s.phase, s.remainingSeconds, s.totalSeconds)
      startTimer()
    },

    pause: () => {
      stopTimer()
      set({ status: 'idle' })
      const s = get()
      notify('idle', s.remainingSeconds, s.totalSeconds)
    },

    reset: () => {
      stopTimer()
      set((s) => ({
        status: 'idle',
        phase: 'focus',
        remainingSeconds: s.focusMinutes * 60,
        totalSeconds: s.focusMinutes * 60,
      }))
      const s = get()
      notify('idle', s.remainingSeconds, s.totalSeconds)
    },

    skip: () => {
      const s = get()
      if (s.phase === 'focus') {
        const total = s.breakMinutes * 60
        set({ phase: 'break', remainingSeconds: total, totalSeconds: total })
        notify('break', total, total)
      } else {
        const total = s.focusMinutes * 60
        set({ phase: 'focus', remainingSeconds: total, totalSeconds: total })
        notify('focus', total, total)
      }
    },
  }
})
