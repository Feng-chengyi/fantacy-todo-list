/**
 * 番茄钟悬浮面板：阶段 / 剩余时间 / 进度条 / 开始暂停重置跳过。
 */
import { useEffect } from 'react'
import { useConfigStore } from '../../stores/configStore'
import { usePomodoroStore } from '../../stores/pomodoroStore'
import { useUiStore } from '../../stores/uiStore'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function PomodoroTimer() {
  const show = useUiStore((s) => s.showPomodoro)
  const setShow = useUiStore((s) => s.setShowPomodoro)
  const status = usePomodoroStore((s) => s.status)
  const phase = usePomodoroStore((s) => s.phase)
  const remainingSeconds = usePomodoroStore((s) => s.remainingSeconds)
  const totalSeconds = usePomodoroStore((s) => s.totalSeconds)
  const start = usePomodoroStore((s) => s.start)
  const pause = usePomodoroStore((s) => s.pause)
  const reset = usePomodoroStore((s) => s.reset)
  const skip = usePomodoroStore((s) => s.skip)
  const init = usePomodoroStore((s) => s.init)
  const focusMinutes = useConfigStore((s) => s.pomodoroFocusMinutes)
  const breakMinutes = useConfigStore((s) => s.pomodoroBreakMinutes)

  // 配置变化时同步时长（运行中不打断）
  useEffect(() => {
    init(focusMinutes, breakMinutes)
  }, [focusMinutes, breakMinutes, init])

  if (!show) return null

  const progress = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0
  const running = status === 'running'
  const phaseLabel = phase === 'focus' ? '专注中' : '休息中'

  return (
    <div className="pomodoro-panel" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: phase === 'focus' ? 'var(--accent)' : 'var(--priority-medium)' }}>
          🍅 {phaseLabel}
        </span>
        <button className="mini-btn" onClick={() => setShow(false)}>
          收起
        </button>
      </div>

      <div className="my-3 text-center text-3xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
        {formatTime(remainingSeconds)}
      </div>

      <div className="progress-track" style={{ background: 'var(--bg)' }}>
        <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {running ? (
          <button className="primary-btn" onClick={pause}>
            暂停
          </button>
        ) : (
          <button className="primary-btn" onClick={start}>
            开始
          </button>
        )}
        <button className="ghost-btn" onClick={reset}>
          重置
        </button>
        <button className="ghost-btn" onClick={skip}>
          跳过
        </button>
      </div>
    </div>
  )
}
