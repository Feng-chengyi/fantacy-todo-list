/**
 * 专注趋势面积图（月度每日 / 年度每月复用）：纯 SVG 实现（颜色经 CSS 变量适配深浅主题）。
 * 渐变填充 + 悬停数据点显示 tooltip；空数据渲染基线提示。
 */
import { useId, useState } from 'react'
import { formatDurationAxis, formatDurationCompact } from '../../../../shared/time'

const W = 760
const H = 240
const PAD = { top: 18, right: 14, bottom: 30, left: 46 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

/** y 轴上界取整到「好看的」分钟刻度，与 HourBarChart 保持同一观感 */
function niceMaxSeconds(maxSeconds: number): number {
  if (maxSeconds <= 0) return 30 * 60
  const minutes = maxSeconds / 60
  const steps = [10, 15, 30, 60, 90, 120, 180, 240, 300, 480, 600, 720, 900, 1200, 1800, 2400, 3000, 4800, 6000]
  for (const s of steps) {
    if (minutes <= s) return s * 60
  }
  return Math.ceil(minutes / 6000) * 6000 * 60
}

export interface TrendPoint {
  /** x 轴标签（如「5日」「3月」） */
  label: string
  /** 该点累计秒数 */
  seconds: number
}

interface TrendAreaChartProps {
  points: TrendPoint[]
  /** tooltip 中的维度名（默认「专注」） */
  unit?: string
}

export function TrendAreaChart({ points, unit = '专注' }: TrendAreaChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const gradId = useId()
  const maxRaw = Math.max(...points.map((p) => p.seconds), 0)
  const max = niceMaxSeconds(maxRaw)
  const ticks = [0, max / 2, max]

  if (points.length === 0 || maxRaw <= 0) {
    return <p className="dash-empty">该周期暂无专注记录</p>
  }

  const n = points.length
  const stepX = n > 1 ? INNER_W / (n - 1) : 0
  const xAt = (i: number) => PAD.left + i * stepX
  const yAt = (v: number) => PAD.top + INNER_H * (1 - v / max)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p.seconds)}`).join(' ')
  const areaPath = `${linePath} L${xAt(n - 1)},${PAD.top + INNER_H} L${xAt(0)},${PAD.top + INNER_H} Z`

  // x 轴标签抽样：点太多时隔 N 个标一个，首尾尽量保留
  const labelStep = Math.max(1, Math.ceil(n / 10))
  const labeled = points.map((_, i) => i).filter((i) => i % labelStep === 0 || i === n - 1)

  return (
    <div className="dash-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="dash-chart-svg" role="img" aria-label="专注时长趋势">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* 横向网格线 + y 轴刻度 */}
        {ticks.map((t) => {
          const y = yAt(t)
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeDasharray="3 4" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="dash-axis-text" fill="var(--text-muted)">
                {formatDurationAxis(t)}
              </text>
            </g>
          )
        })}
        {/* 面积 + 折线 */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* 数据点 + 悬停热区 */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <circle cx={xAt(i)} cy={yAt(p.seconds)} r={hover === i ? 4.5 : 3} fill="var(--accent)" stroke="var(--bg-elevated)" strokeWidth="1.5" />
            <rect
              x={xAt(i) - Math.max(stepX / 2, 10)}
              y={PAD.top}
              width={Math.max(stepX, 20)}
              height={INNER_H}
              fill="transparent"
            />
          </g>
        ))}
        {/* x 轴标签 */}
        {labeled.map((i) => (
          <text key={i} x={xAt(i)} y={H - 10} textAnchor="middle" className="dash-axis-text" fill="var(--text-muted)">
            {points[i].label}
          </text>
        ))}
      </svg>
      {hover != null && (
        <div
          className="dash-tooltip"
          style={{ left: `${(xAt(hover) / W) * 100}%`, top: `${(yAt(points[hover].seconds) / H) * 100}%` }}
        >
          {points[hover].label} · {unit} {formatDurationCompact(points[hover].seconds)}
        </div>
      )}
    </div>
  )
}
