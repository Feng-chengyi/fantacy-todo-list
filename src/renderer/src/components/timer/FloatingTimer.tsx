/**
 * v3 悬浮计时器：计时启动后常驻右下角，切换页面不中断。
 * - 正向计时：走时 + 暂停/继续 + 停止（停止 = 提交专注并落库）；
 * - 倒计时：按任务 countdownSec 递减，归零弹系统通知 + 提示音并自动提交；
 * - 任务完成后自动停止计时由勾选逻辑触发（commitFocus 统一收口）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatHms } from '../../../../shared/time'
import { timerElapsedMs } from '../../stores/uiStore'
import { useUiStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { commitFocus } from '../../services/focus'

/** 倒计时归零提示音（WebAudio 短促三连音，无外部资源依赖） */
function playBeep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.2, 0.4].forEach((delay, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 2 ? 1046 : 784
      gain.gain.setValueAtTime(0.18, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.16)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.18)
    })
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    // 音频设备不可用时静默失败，通知仍然弹出
  }
}

export function FloatingTimer() {
  const timer = useUiStore((s) => s.timer)
  const pauseTimer = useUiStore((s) => s.pauseTimer)
  const resumeTimer = useUiStore((s) => s.resumeTimer)
  const tasks = useTaskStore((s) => s.tasks)

  const task = useMemo(() => tasks.find((t) => t.id === timer?.taskId) ?? null, [tasks, timer?.taskId])
  const isCountdown = task?.timerKind === 'countdown' && !!task?.countdownSec

  const [label, setLabel] = useState('')
  const firedRef = useRef(false)

  // 走时：每秒刷新（paused 冻结）；倒计时归零触发提醒 + 自动提交
  useEffect(() => {
    if (!timer) {
      setLabel('')
      firedRef.current = false
      return
    }
    const render = (): void => {
      const elapsedSec = Math.floor(timerElapsedMs(timer) / 1000)
      if (isCountdown && task?.countdownSec) {
        const remain = Math.max(0, task.countdownSec - elapsedSec)
        setLabel(formatHms(remain))
        if (remain <= 0 && !firedRef.current) {
          firedRef.current = true
          playBeep()
          try {
            new Notification('倒计时结束', { body: `「${task.title}」的倒计时已归零` })
          } catch {
            // 通知权限异常时静默
          }
          void commitFocus()
        }
      } else {
        setLabel(formatHms(elapsedSec))
      }
    }
    render()
    if (timer.paused) return
    const id = window.setInterval(render, 1000)
    return () => window.clearInterval(id)
  }, [timer, isCountdown, task?.countdownSec, task?.title])

  if (!timer) return null

  return (
    <div className="floating-timer">
      <div className="floating-timer-main">
        <span className="floating-timer-title">
          {isCountdown ? '⏳ ' : '⏱ '}
          {task?.title ?? '自由计时'}
        </span>
        <span className={`floating-timer-clock ${timer.paused ? 'paused' : ''}`}>{label}</span>
      </div>
      <div className="floating-timer-actions">
        {timer.paused ? (
          <button className="mini-btn timer-btn" onClick={resumeTimer} title="继续">
            ▶ 继续
          </button>
        ) : (
          <button className="mini-btn timer-btn" onClick={pauseTimer} title="暂停">
            ⏸ 暂停
          </button>
        )}
        <button
          className="mini-btn timer-btn"
          onClick={() => {
            // 倒计时未归零时手动结束 = 提前结束（已产生时长照常落库）
            void commitFocus()
          }}
          title={isCountdown ? '提前结束' : '停止计时'}
        >
          ⏹ 停止
        </button>
      </div>
    </div>
  )
}
