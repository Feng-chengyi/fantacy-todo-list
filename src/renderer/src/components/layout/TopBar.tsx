/**
 * 顶部栏：应用名 + 视图切换（月/周）+ 翻页 + 今天 + 计时 + 番茄 + 设置 + 窗口控制。
 */
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { parseLocal, todayStr, weekDates } from '../../../../shared/date'
import { formatHms } from '../../../../shared/time'
import { useConfigStore } from '../../stores/configStore'
import { timerElapsedMs, useUiStore } from '../../stores/uiStore'
import * as ipc from '../../services/ipc'

export function TopBar() {
  const currentYear = useUiStore((s) => s.currentYear)
  const currentMonth = useUiStore((s) => s.currentMonth)
  const nextMonth = useUiStore((s) => s.nextMonth)
  const prevMonth = useUiStore((s) => s.prevMonth)
  const goToday = useUiStore((s) => s.goToday)
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)
  const prevWeek = useUiStore((s) => s.prevWeek)
  const nextWeek = useUiStore((s) => s.nextWeek)
  const prevDay = useUiStore((s) => s.prevDay)
  const nextDay = useUiStore((s) => s.nextDay)
  const selectedDate = useUiStore((s) => s.selectedDate)
  const setShowSettings = useUiStore((s) => s.setShowSettings)
  const setShowSearch = useUiStore((s) => s.setShowSearch)
  const setShowHelp = useUiStore((s) => s.setShowHelp)
  const openTimerPanel = useUiStore((s) => s.openTimerPanel)
  const timer = useUiStore((s) => s.timer)
  const weekStart = useConfigStore((s) => s.weekStart)

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

  const isWeek = view === 'week'
  const isDay = view === 'day'
  const isList = view === 'list'

  let label: string
  if (isList) {
    label = '全部任务 · 按日期分组'
  } else if (isWeek) {
    const days = weekDates(selectedDate ?? todayStr(), weekStart)
    label = `${format(parseLocal(days[0]), 'M 月 d 日')} – ${format(parseLocal(days[6]), 'M 月 d 日')}`
  } else if (isDay) {
    label = format(parseLocal(selectedDate ?? todayStr()), 'yyyy 年 M 月 d 日')
  } else {
    label = format(new Date(currentYear, currentMonth, 1), 'yyyy 年 M 月')
  }

  const onPrev = isWeek ? prevWeek : isDay ? prevDay : prevMonth
  const onNext = isWeek ? nextWeek : isDay ? nextDay : nextMonth

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-3 border-b px-4"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      <h1 className="text-sm font-bold tracking-wide" style={{ color: 'var(--accent)' }}>
        Fantacy Todo
      </h1>

      <div className="view-tabs">
        <button className={!isWeek && !isDay && !isList ? 'active' : ''} onClick={() => setView('month')}>
          月
        </button>
        <button className={isWeek ? 'active' : ''} onClick={() => setView('week')}>
          周
        </button>
        <button className={isDay ? 'active' : ''} onClick={() => setView('day')}>
          日
        </button>
        <button className={isList ? 'active' : ''} onClick={() => setView('list')}>
          列表
        </button>
      </div>

      {!isList && (
        <div className="mx-2 flex items-center gap-1">
          <button className="nav-btn" onClick={onPrev} aria-label="上一页">
            ‹
          </button>
          <span className="w-44 text-center text-sm font-semibold">{label}</span>
          <button className="nav-btn" onClick={onNext} aria-label="下一页">
            ›
          </button>
        </div>
      )}
      {isList && <span className="ml-2 text-sm font-semibold">{label}</span>}

      <button className="text-btn" onClick={goToday}>
        今天
      </button>

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
