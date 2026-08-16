/**
 * 正向计时秒表展示：仅当 uiStore.timer 指向当前任务时渲染进行中的 hh:mm:ss。
 * 适配暂停语义：paused 时冻结显示。
 */
import { useEffect, useState } from 'react'
import { formatHms } from '../../../../shared/time'
import { timerElapsedMs, useUiStore } from '../../stores/uiStore'

export function Stopwatch({ taskId }: { taskId: string }) {
  const timer = useUiStore((s) => s.timer)
  const running = timer?.taskId === taskId
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
