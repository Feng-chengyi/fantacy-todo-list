/**
 * 桌宠动画状态机：聚合三类联动源并输出当前动画。
 * 优先级：一次性动画（waving/finishing/jumping）> timing（正向计时）
 *       > running（拖拽方向）> idle。
 * - 一次性动画：非循环（finishing/jumping）播完自动回落；waving 循环播放、
 *   2.4s 后自动回落；重复触发用 restartKey 强制重播。
 * - timing/running 为持续状态，由外部（IPC 计时通知 / 拖拽方向）维护。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PetAnim } from './petAssets'

/** 一次性触发动画集合 */
export type OneShotAnim = 'waving' | 'finishing' | 'jumping'

const WAVING_HOLD_MS = 2400

export interface PetAnimController {
  /** 当前动画（受控传给 SpritePetStage） */
  anim: PetAnim
  /** 重复触发同动画时的重启序号 */
  restartKey: number
  /** 触发一次性动画（点击 / 任务完成 / 番茄完成） */
  trigger(anim: OneShotAnim): void
  /** 正向计时进行中（IPC pet:anim timing） */
  setTiming(on: boolean): void
  /** 拖拽方向（null = 未拖拽） */
  setRunning(dir: 'right' | 'left' | null): void
  /** 非循环动画播完回落（交给 onAnimFinish） */
  handleFinish(anim: PetAnim): void
}

export function usePetAnimState(): PetAnimController {
  const [oneShot, setOneShot] = useState<{ anim: OneShotAnim; seq: number } | null>(null)
  const [timing, setTimingState] = useState(false)
  const [running, setRunningState] = useState<'right' | 'left' | null>(null)
  const waveTimer = useRef<number | null>(null)
  const seq = useRef(0)

  const clearWaveTimer = useCallback(() => {
    if (waveTimer.current != null) {
      window.clearTimeout(waveTimer.current)
      waveTimer.current = null
    }
  }, [])

  const trigger = useCallback(
    (anim: OneShotAnim) => {
      clearWaveTimer()
      seq.current += 1
      const mySeq = seq.current
      setOneShot({ anim, seq: mySeq })
      if (anim === 'waving') {
        waveTimer.current = window.setTimeout(() => {
          waveTimer.current = null
          // 仅当还是这一次触发时回落
          setOneShot((cur) => (cur?.seq === mySeq ? null : cur))
        }, WAVING_HOLD_MS)
      }
    },
    [clearWaveTimer],
  )

  // 卸载清理挥手定时器（返回清理函数，避免旧写法把 clearWaveTimer 当 effect 体、卸载不清理）
  useEffect(() => () => clearWaveTimer(), [clearWaveTimer])

  const setTiming = useCallback((on: boolean) => setTimingState(on), [])
  const setRunning = useCallback((dir: 'right' | 'left' | null) => setRunningState(dir), [])

  const handleFinish = useCallback((anim: PetAnim) => {
    if (anim === 'finishing' || anim === 'jumping') {
      setOneShot((cur) => (cur?.anim === anim ? null : cur))
    }
  }, [])

  const anim: PetAnim = oneShot
    ? oneShot.anim
    : timing
      ? 'timing'
      : running === 'right'
        ? 'running-right'
        : running === 'left'
          ? 'running-left'
          : 'idle'

  return { anim, restartKey: oneShot?.seq ?? 0, trigger, setTiming, setRunning, handleFinish }
}
