/**
 * 专注时长分布圆环图（饼图）：纯 SVG 实现，颜色经 CSS 变量（--chart-N）适配深浅主题。
 * 中心展示区间总时长，悬停切片 / 图例时切换为该分类占比；图例按时长降序排列。
 */
import { useState } from 'react'
import type { FocusSplitSlice } from '../../../../shared/stats'
import { formatDurationCompact } from '../../../../shared/time'

/** 分类调色板数量（与 index.css 的 --chart-1..6 对应） */
const CHART_COLOR_COUNT = 6

const SIZE = 176
const STROKE = 24
const R = (SIZE - STROKE) / 2 - 6
const CIRCUMFERENCE = 2 * Math.PI * R
/** 相邻切片间的间隙（SVG 弧长 px） */
const SLICE_GAP = 2.5

interface DonutChartProps {
  slices: FocusSplitSlice[]
  /** 中心默认主标签（如「区间总时长」） */
  centerLabel: string
}

export function DonutChart({ slices, centerLabel }: DonutChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const total = slices.reduce((sum, s) => sum + s.seconds, 0)

  let dashOffset = 0
  const arcs = slices.map((slice, i) => {
    const dash = Math.max((slice.seconds / total) * CIRCUMFERENCE - SLICE_GAP, 0.5)
    const arc = {
      i,
      dash,
      offset: dashOffset,
      color: `var(--chart-${(i % CHART_COLOR_COUNT) + 1})`,
    }
    dashOffset += (slice.seconds / total) * CIRCUMFERENCE
    return arc
  })

  const activeSlice = active != null ? slices[active] : null

  return (
    <div className="dash-donut">
      <svg
        className="dash-donut-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="专注时长分类占比"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--bg)"
          strokeWidth={STROKE}
        />
        {arcs.map((a) => (
          <circle
            key={a.i}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={active === a.i ? STROKE + 5 : STROKE}
            strokeDasharray={`${a.dash} ${CIRCUMFERENCE - a.dash}`}
            strokeDashoffset={-a.offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            onMouseEnter={() => setActive(a.i)}
            onMouseLeave={() => setActive(null)}
          />
        ))}
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 8}
          textAnchor="middle"
          className="dash-donut-center-label"
          fill="var(--text-muted)"
        >
          {activeSlice ? activeSlice.label : centerLabel}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 16}
          textAnchor="middle"
          className="dash-donut-center-value"
          fill="var(--text)"
        >
          {activeSlice ? `${activeSlice.percent}%` : formatDurationCompact(total)}
        </text>
      </svg>
      <ul className="dash-legend">
        {slices.map((s, i) => (
          <li
            key={s.label}
            className={active === i ? 'active' : ''}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span
              className="dash-legend-dot"
              style={{ background: `var(--chart-${(i % CHART_COLOR_COUNT) + 1})` }}
            />
            <span className="dash-legend-label" title={s.label}>
              {s.label}
            </span>
            <span className="dash-legend-value">{formatDurationCompact(s.seconds)}</span>
            <span className="dash-legend-pct">{s.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
