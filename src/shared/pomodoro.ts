/**
 * 番茄钟展示纯函数。
 * 桌宠徽标 / 右键菜单仅显示阶段文案、不显示秒数：
 * pet:notify-pomodoro 只在动作时推送，秒数必然是旧值（形似卡死），见 QA Bug 4。
 */
import type { PomodoroPhase } from './types'

/** 阶段 → 徽标/菜单文案；idle 返回空串（调用方据此不渲染） */
export function pomodoroPhaseLabel(phase: PomodoroPhase): string {
  if (phase === 'focus') return '🍅 专注中'
  if (phase === 'break') return '☕ 休息中'
  return ''
}
