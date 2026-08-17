/**
 * 月度专注时段分布柱状图：24 小时横轴，纯 SVG 实现（颜色经 CSS 变量适配深浅主题）。
 * 悬停柱体显示该小时区间的累计专注时长，帮助定位高效产出窗口。
 */
import { useState } from 'react'
import { formatDurationAxis, formatDurationCompact } from '../../../../shared/time'

const W = 760
const H = 240
const PAD = { top: 18, right: 14, bottom: 30, left: 46 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom
const BAR_GAP = 5

/** y 轴上界取整到「好看的」分钟刻度（10/30/60… 序列），保证网格线读数友好 */
function niceMaxSeconds(maxSeconds: number): number {
  if (maxSeconds <= 0) return 30 * 60
  const minutes = maxSeconds / 60
  const steps = [10, 15, 30, 60, 90, 120, 180, 240, 300, 480, 600, 720, 900, 1200, 1800, 2400, 3000, 4800, 6000]
  for (const s of steps) {
    if (minutes <= s) return s * 60
  }
  return Math.ceil(minutes / 6000) * 6000 * 60
}

interface HourBarChartProps {
  /** 24 桶：索引 = 小时（0–23），值 = 该小时区间累计秒数 */
  hours: number[]
}

export function HourBarChart({ hours }: HourBarChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const maxRaw = Math.max(...hours, 0)
  const max = niceMaxSeconds(maxRaw)
  const barW = INNER_W / hours.length - BAR_GAP
  const ticks = [0, max / 2, max]

  if (maxRaw <= 0) {
    return <p className="dash-empty">本月暂无专注记录</p>
  }

  return (
    <div className="dash-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="dash-chart-svg" role="img" aria-label="月度专注时段分布">
        {/* 横向网格线 + y 轴刻度 */}
        {ticks.map((t) => {
          const y = PAD.top + INNER_H * (1 - t / max)
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeDasharray="3 4" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="dash-axis-text" fill="var(--text-muted)">
                {formatDurationAxis(t)}
              </text>
            </g>
          )
        })}
        {/* 24 根柱体 */}
        {hours.map((sec, i) => {
          const h = max > 0 ? (sec / max) * INNER_H : 0
          const x = PAD.left + i * (INNER_W / hours.length) + BAR_GAP / 2
          const y = PAD.top + INNER_H - h
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Math.max(barW, 2)}
              height={Math.max(h, sec > 0 ? 2 : 0)}
              rx={3}
              fill="var(--accent)"
              opacity={hover == null || hover === i ? 1 : 0.35}
              onMouseEnter={() => setHover(i)}
            />
          )
        })}
        {/* x 轴小时标签（每 3 小时一个） */}
        {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((h) => (
          <text
            key={h}
            x={PAD.left + (h + 0.5) * (INNER_W / hours.length)}
            y={H - 10}
            textAnchor="middle"
            className="dash-axis-text"
            fill="var(--text-muted)"
          >
            {h}时
          </text>
        ))}
      </svg>
      {hover != null && (
        <div
          className="dash-tooltip"
          style={{ left: `${((PAD.left + (hover + 0.5) * (INNER_W / hours.length)) / W) * 100}%`, top: `${(PAD.top / H) * 100}%` }}
        >
          {hover}:00 – {hover + 1}:00 · {formatDurationCompact(hours[hover])}
        </div>
      )}
    </div>
  )
}
