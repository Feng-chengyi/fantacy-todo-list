/**
 * 番茄钟陪伴徽标：🍅 专注 / ☕ 休息（常驻显示，区别于气泡的自动消失）。
 */
import type { PomodoroState } from '../../shared/types'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function PomodoroBadge({ state }: { state: PomodoroState | null }) {
  if (!state || state.phase === 'idle') return null
  const label = state.phase === 'focus' ? '🍅 专注' : '☕ 休息'
  return <div className="pomodoro-badge">{`${label} ${formatTime(state.remainingSeconds)}`}</div>
}
