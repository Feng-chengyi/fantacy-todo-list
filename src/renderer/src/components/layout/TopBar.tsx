/**
 * 顶部栏：应用名 + 当前页面标题 + 计时 + 番茄 + 搜索 + 帮助 + 设置 + 窗口控制。
 * 月/周/日/列表视图切换与翻页控件已迁移至时间轴页面（导航重构 v2.4.0）。
 */
import { useEffect, useState } from 'react'
import { formatHms } from '../../../../shared/time'
import { timerElapsedMs, useUiStore } from '../../stores/uiStore'
import * as ipc from '../../services/ipc'

const PAGE_TITLES: Record<string, string> = {
  todo: '待办',
  inbox: '收集箱',
  timeline: '时间轴',
  stats: '统计',
  habits: '习惯',
  goals: '倒数日',
  timer: '计时',
}

export function TopBar() {
  const page = useUiStore((s) => s.page)
  const setShowSettings = useUiStore((s) => s.setShowSettings)
  const setShowSearch = useUiStore((s) => s.setShowSearch)
  const setShowHelp = useUiStore((s) => s.setShowHelp)
  const openTimerPanel = useUiStore((s) => s.openTimerPanel)
  const timer = useUiStore((s) => s.timer)

  // 计时进行中：每秒刷新顶部走时（paused 冻结）
  const timerRunning = timer !== null
  const [timerLabel, setTimerLabel] = useState('')
  useEffect(() => {
    if (!timer) {
      setTimerLabel('')
      return
    }
    const tick = (): void => setTimerLabel(formatHms(Math.floor(timerElapsedMs(timer) / 1000)))
    tick()
    if (timer.paused) return
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [timer])

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-3 border-b px-4"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      <h1 className="text-sm font-bold tracking-wide" style={{ color: 'var(--accent)' }}>
        Fantacy Todo
      </h1>

      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {PAGE_TITLES[page] ?? ''}
      </span>

      <div className="flex-1" />

      <button
        className={`text-btn ${timerRunning ? 'timer-running' : ''}`}
        onClick={() => openTimerPanel()}
        title="正向计时器"
      >
        {timerRunning ? `⏱ ${timerLabel}` : '⏱ 计时'}
      </button>
      <button className="text-btn" onClick={() => openTimerPanel('pomodoro')} title="番茄钟">
        🍅 番茄
      </button>
      <button className="text-btn" onClick={() => setShowSearch(true)} title="全局搜索">
        🔍 搜索
      </button>
      <button className="text-btn" onClick={() => setShowHelp(true)} title="使用说明">
        帮助
      </button>
      <button className="text-btn" onClick={() => setShowSettings(true)}>
        设置
      </button>
      <button className="text-btn" onClick={() => void ipc.minimize()} aria-label="最小化">
        —
      </button>
      <button className="text-btn hover:bg-red-500/10" onClick={() => void ipc.close()} aria-label="关闭">
        ✕
      </button>
    </header>
  )
}
