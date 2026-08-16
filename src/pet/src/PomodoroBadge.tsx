/**
 * 番茄钟陪伴徽标：🍅 专注中 / ☕ 休息中（常驻显示，区别于气泡的自动消失）。
 * 仅显示阶段文案不显示秒数：pet:notify-pomodoro 只在动作时推送，
 * 秒数必然是旧值（形似卡死），见 QA Bug 4。
 */
import { pomodoroPhaseLabel } from '../../shared/pomodoro'
import type { PomodoroState } from '../../shared/types'

export function PomodoroBadge({ state }: { state: PomodoroState | null }) {
  if (!state || state.phase === 'idle') return null
  return <div className="pomodoro-badge">{pomodoroPhaseLabel(state.phase)}</div>
}
