/**
 * 番茄钟展示纯函数单测（QA Bug 4：徽标/菜单只显示阶段文案不显示秒数）。
 */
import { describe, expect, it } from 'vitest'
import { pomodoroPhaseLabel } from './pomodoro'

describe('pomodoroPhaseLabel', () => {
  it('focus → 🍅 专注中', () => {
    expect(pomodoroPhaseLabel('focus')).toBe('🍅 专注中')
  })
  it('break → ☕ 休息中', () => {
    expect(pomodoroPhaseLabel('break')).toBe('☕ 休息中')
  })
  it('idle → 空串（调用方据此不渲染）', () => {
    expect(pomodoroPhaseLabel('idle')).toBe('')
  })
})
