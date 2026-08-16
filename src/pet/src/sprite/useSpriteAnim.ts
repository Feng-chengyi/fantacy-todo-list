/**
 * 精灵帧动画引擎：rAF 按动画 fps 换帧；非 loop 动画播完触发 onFinish。
 * 与 React 解耦（纯逻辑 + 订阅），供 SpritePetStage 渲染当前帧。
 */
import { useEffect, useRef, useState } from 'react'
import type { PetAnimationMeta, PetAnim } from './petAssets'

export function useSpriteAnim(
  animations: Record<PetAnim, PetAnimationMeta>,
  current: PetAnim,
  restartKey: number,
  onFinish?: (anim: PetAnim) => void,
): number {
  const [frame, setFrame] = useState(0)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  useEffect(() => {
    const meta = animations[current]
    if (!meta) {
      setFrame(0)
      return
    }
    // 动画切换 / 重播立即回到首帧
    setFrame(meta.frames[0])

    const interval = 1000 / Math.max(1, meta.fps)
    let idx = 0
    let raf = 0
    let last = performance.now()
    let stopped = false

    const tick = (now: number): void => {
      if (stopped) return
      if (now - last >= interval) {
        last = now
        idx++
        if (idx >= meta.frames.length) {
          if (meta.loop) {
            idx = 0
          } else {
            // 非循环动画停在末帧并回调（一次）
            idx = meta.frames.length - 1
            onFinishRef.current?.(current)
            setFrame(meta.frames[idx])
            return
          }
        }
        setFrame(meta.frames[idx])
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, restartKey, animations])

  return frame
}
