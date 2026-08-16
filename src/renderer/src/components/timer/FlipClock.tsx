/**
 * 翻页时钟（flip clock）：hh:mm:ss 每位一张数字卡片，数字变化时播放翻页动画。
 * 纯 CSS 动画（rotateX 翻动），无第三方依赖；秒位每秒翻动一次。
 */
import { useEffect, useRef } from 'react'

interface DigitProps {
  value: string
}

/** 单个数字卡片：值变化时挂 .flip-tick 触发一次翻页动画（animationend 后移除） */
function Digit({ value }: DigitProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const prev = useRef(value)

  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    const el = ref.current
    if (!el) return
    el.classList.remove('flip-tick')
    // 强制 reflow，确保同名动画可重复触发
    void el.offsetWidth
    el.classList.add('flip-tick')
  }, [value])

  return (
    <span className="flip-card" ref={ref}>
      <span className="flip-card-face">{value}</span>
    </span>
  )
}

/** 一组数字（如「25」） */
function DigitGroup({ value }: { value: string }) {
  return (
    <span className="flip-group">
      {value.split('').map((ch, i) => (
        <Digit key={i} value={ch} />
      ))}
    </span>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function FlipClock({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return (
    <div className="flip-clock" aria-label={`${pad(h)}:${pad(m)}:${pad(s)}`}>
      <DigitGroup value={pad(h)} />
      <span className="flip-colon">:</span>
      <DigitGroup value={pad(m)} />
      <span className="flip-colon">:</span>
      <DigitGroup value={pad(s)} />
    </div>
  )
}
