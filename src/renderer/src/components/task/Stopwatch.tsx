/**
 * 正向计时秒表展示：仅当 uiStore.timer 指向当前任务实例时渲染进行中的 hh:mm:ss。
 * 适配暂停语义：paused 时冻结显示。
 * 重复任务按 (taskId, occurrenceDate) 隔离，避免同任务其它实例误显示走时。
 */
import { useEffect, useState } from 'react'
import { formatHms } from '../../../../shared/time'
import { isSameTimerInstance } from '../../../../shared/focus'
import { timerElapsedMs, useUiStore } from '../../stores/uiStore'

interface Props {
  taskId: string
  occurrenceDate?: string | null
}

export function Stopwatch({ taskId, occurrenceDate = null }: Props) {
  const timer = useUiStore((s) => s.timer)
  const running = !!timer && isSameTimerInstance(timer, taskId, occurrenceDate ?? null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running || !timer) return
    const tick = (): void => setElapsed(Math.floor(timerElapsedMs(timer) / 1000))
    tick()
    if (timer.paused) return
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [running, timer])

  if (!running) return null
  return <span className="stopwatch">{formatHms(elapsed)}</span>
}
