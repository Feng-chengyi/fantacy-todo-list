/**
 * 统计看板（专注数据分析仪表盘 + 任务统计）。
 * 仪表盘信息层级：宏观总览 → 单日快照 → 分类拆解 → 时段洞察 → 中长期趋势，
 * 图表全部自绘 SVG（DonutChart / HourBarChart / TrendAreaChart），深浅色主题经 CSS 变量适配。
 * 数据基于 tasks + overrides + sessions + habits（Zustand store），随 store 实时更新。
 */
import { useMemo, useState } from 'react'
import type { Priority } from '../../../../shared/types'
import { ALL_PRIORITIES, PRIORITY_LABELS } from '../../../../shared/defaults'
import {
  categoryFocusSplit,
  computeFocusSummary,
  computeStats,
  dailyFocusSnapshot,
  FREE_FOCUS_LABEL,
  hourlyFocusDistribution,
  monthlyDailyTrend,
  yearlyMonthlyTrend,
  type Completion,
} from '../../../../shared/stats'
import { streakOf } from '../../../../shared/habit'
import {
  addDays,
  currentYearMonth,
  endOfMonthStr,
  shiftMonth,
  startOfMonthStr,
  todayStr,
  weekDates,
} from '../../../../shared/date'
import { formatDurationCompact } from '../../../../shared/time'
import { useConfigStore } from '../../stores/configStore'
import { useTaskStore } from '../../stores/taskStore'
import { useHabitStore } from '../../stores/habitStore'
import { DonutChart } from './DonutChart'
import { HourBarChart } from './HourBarChart'
import { TrendAreaChart } from './TrendAreaChart'

function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

interface RateRowProps {
  label: string
  completion: Completion
  sub?: string
}

function RateRow({ label, completion, sub }: RateRowProps) {
  const percent = pct(completion.done, completion.total)
  return (
    <div className="stat-rate">
      <div className="stat-rate-head">
        <span className="stat-rate-label">{label}</span>
        <span className="stat-rate-value">
          {completion.done}/{completion.total}
          {sub && <span className="stat-rate-sub"> {sub}</span>}
        </span>
      </div>
      <div className="progress-track" style={{ background: 'var(--bg)' }}>
        <div className="progress-fill" style={{ width: `${percent}%`, background: 'var(--accent)' }} />
      </div>
      <span className="stat-rate-pct">{percent}%</span>
    </div>
  )
}

interface BarProps {
  label: string
  value: number
  max: number
  color: string
}

function Bar({ label, value, max, color }: BarProps) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="stat-bar-row">
      <span className="stat-bar-label">{label}</span>
      <div className="stat-bar-track" style={{ background: 'var(--bg)' }}>
        <div className="stat-bar-fill" style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="stat-bar-value">{value}</span>
    </div>
  )
}

/** 历史回溯箭头控件（月份） */
function MonthNav({
  year,
  month,
  onChange,
}: {
  year: number
  month: number
  onChange: (ym: { year: number; month: number }) => void
}) {
  return (
    <div className="dash-nav">
      <button className="dash-nav-btn" aria-label="上一月" onClick={() => onChange(shiftMonth(year, month, -1))}>
        ‹
      </button>
      <span className="dash-nav-label">
        {year} 年 {month + 1} 月
      </span>
      <button className="dash-nav-btn" aria-label="下一月" onClick={() => onChange(shiftMonth(year, month, 1))}>
        ›
      </button>
    </div>
  )
}

/** 历史回溯箭头控件（年份） */
function YearNav({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  return (
    <div className="dash-nav">
      <button className="dash-nav-btn" aria-label="上一年" onClick={() => onChange(year - 1)}>
        ‹
      </button>
      <span className="dash-nav-label">{year} 年</span>
      <button className="dash-nav-btn" aria-label="下一年" onClick={() => onChange(year + 1)}>
        ›
      </button>
    </div>
  )
}

type DistMode = 'day' | 'week' | 'month' | 'custom'

/** ISO 时刻 → 本地 HH:mm */
function timeOf(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ISO 时刻 → 本地 YYYY-MM-DD（与 stats.sessionDate 同口径，避免 UTC 日期错归） */
function localDateOf(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function StatsPanel() {
  const tasks = useTaskStore((s) => s.tasks)
  const overrides = useTaskStore((s) => s.overrides)
  const sessions = useTaskStore((s) => s.sessions)
  const weekStart = useConfigStore((s) => s.weekStart)
  const habits = useHabitStore((s) => s.habits)

  const today = todayStr()

  /* ---- 模块 1：累计专注汇总（自定义起始时间范围，空 = 全部历史） ---- */
  const [focusFrom, setFocusFrom] = useState('')
  const focusSummary = useMemo(
    () => computeFocusSummary(sessions, focusFrom ? { from: focusFrom } : undefined),
    [sessions, focusFrom],
  )

  /* ---- 模块 2：当日专注（左右箭头回溯历史单日） ---- */
  const [selectedDay, setSelectedDay] = useState(today)
  const daySnapshot = useMemo(() => dailyFocusSnapshot(sessions, selectedDay), [sessions, selectedDay])
  const isFutureDay = selectedDay >= today

  /* ---- 模块 3：专注时长分布饼图（日 / 周 / 月 / 自定义 + 明细入口） ---- */
  const [distMode, setDistMode] = useState<DistMode>('day')
  const [customFrom, setCustomFrom] = useState(() => addDays(todayStr(), -29))
  const [customTo, setCustomTo] = useState(() => todayStr())
  const [showDetail, setShowDetail] = useState(false)

  const nowYm = currentYearMonth()
  const distRange = useMemo((): { from: string; to: string } | null => {
    if (distMode === 'day') return { from: today, to: today }
    if (distMode === 'week') {
      const week = weekDates(today, weekStart)
      return { from: week[0], to: week[6] }
    }
    if (distMode === 'month') {
      return {
        from: startOfMonthStr(nowYm.year, nowYm.month),
        to: endOfMonthStr(nowYm.year, nowYm.month),
      }
    }
    if (!customFrom || !customTo || customFrom > customTo) return null
    return { from: customFrom, to: customTo }
  }, [distMode, today, weekStart, customFrom, customTo, nowYm.year, nowYm.month])

  const slices = useMemo(
    () => (distRange ? categoryFocusSplit(sessions, tasks, distRange.from, distRange.to) : []),
    [sessions, tasks, distRange],
  )

  const titleById = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks])
  const detailRows = useMemo(() => {
    if (!distRange || !showDetail) return []
    return sessions
      .filter((s) => {
        const dateStr = localDateOf(s.startedAt)
        return dateStr >= distRange.from && dateStr <= distRange.to
      })
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .map((s) => ({
        id: s.id,
        date: localDateOf(s.startedAt),
        time: timeOf(s.startedAt),
        title: s.taskId ? (titleById.get(s.taskId) ?? '已删除任务') : FREE_FOCUS_LABEL,
        seconds: s.durationSec,
      }))
  }, [sessions, distRange, showDetail, titleById])

  /* ---- 模块 4：月度专注时段分布（24 小时柱状图，月份切换） ---- */
  const [hourYm, setHourYm] = useState(nowYm)
  const hourBuckets = useMemo(
    () => hourlyFocusDistribution(sessions, hourYm.year, hourYm.month),
    [sessions, hourYm],
  )
  const peakHour = hourBuckets.reduce((best, sec, h) => (sec > hourBuckets[best] ? h : best), 0)
  const hasHourData = hourBuckets[peakHour] > 0

  /* ---- 模块 5：月度专注趋势（面积图，月份切换） ---- */
  const [trendYm, setTrendYm] = useState(nowYm)
  const monthPoints = useMemo(
    () =>
      monthlyDailyTrend(sessions, trendYm.year, trendYm.month).map((p) => ({
        label: `${p.day}日`,
        seconds: p.seconds,
      })),
    [sessions, trendYm],
  )
  const monthTotal = monthPoints.reduce((sum, p) => sum + p.seconds, 0)

  /* ---- 模块 6：年度专注趋势（面积图，年份切换） ---- */
  const [trendYear, setTrendYear] = useState(nowYm.year)
  const yearPoints = useMemo(
    () => yearlyMonthlyTrend(sessions, trendYear).map((p) => ({ label: p.label, seconds: p.seconds })),
    [sessions, trendYear],
  )
  const yearTotal = yearPoints.reduce((sum, p) => sum + p.seconds, 0)

  /* ---- 任务统计（原有） ---- */
  const stats = useMemo(() => computeStats(tasks, overrides, { weekStart }), [tasks, overrides, weekStart])
  const habitStreaks = useMemo(() => {
    return habits
      .map((h) => ({ title: h.title, streak: streakOf(h, today) }))
      .sort((a, b) => b.streak - a.streak)
  }, [habits, today])
  const maxHabitStreak = habitStreaks.reduce((m, x) => Math.max(m, x.streak), 0)

  const priorityMax = Math.max(1, ...ALL_PRIORITIES.map((p) => stats.priorityDistribution[p]))
  const categoryEntries = Object.entries(stats.categoryDistribution).sort((a, b) => b[1] - a[1])
  const categoryMax = Math.max(1, ...categoryEntries.map(([, n]) => n))

  const distRangeLabel = distRange
    ? distRange.from === distRange.to
      ? distRange.from
      : `${distRange.from} ~ ${distRange.to}`
    : ''

  return (
    <div className="stats-panel">
      <h2 className="mb-4 text-base font-bold">统计看板</h2>

      <p className="dash-section-title">专注数据分析</p>

      {/* 模块 1：累计专注汇总 */}
      <section className="stats-card">
        <div className="stats-card-head-row">
          <h3 className="stats-card-title">累计专注汇总</h3>
          <label className="stats-range-picker">
            <span>起始日期</span>
            <input type="date" value={focusFrom} onChange={(e) => setFocusFrom(e.target.value)} />
            {focusFrom && (
              <button className="text-btn" onClick={() => setFocusFrom('')}>
                全部
              </button>
            )}
          </label>
        </div>
        <div className="stat-counts">
          <div className="stat-count">
            <span className="stat-count-num">{focusSummary.totalSessions}</span>
            <span className="stat-count-label">专注次数</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num" style={{ color: 'var(--accent)' }}>
              {formatDurationCompact(focusSummary.totalSeconds)}
            </span>
            <span className="stat-count-label">累计时长</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num">{formatDurationCompact(focusSummary.avgSecondsPerDay)}</span>
            <span className="stat-count-label">日均时长</span>
          </div>
        </div>
        <p className="stat-hint">
          统计范围：{focusFrom ? `${focusFrom} 至今` : '全部历史'}；正向计时不足 5 秒的会话不计入
        </p>
      </section>

      {/* 模块 2：当日专注（历史回溯） */}
      <section className="stats-card">
        <div className="stats-card-head-row">
          <h3 className="stats-card-title">当日专注</h3>
          <div className="dash-nav">
            <button className="dash-nav-btn" aria-label="前一天" onClick={() => setSelectedDay(addDays(selectedDay, -1))}>
              ‹
            </button>
            <input
              className="dash-nav-date"
              type="date"
              value={selectedDay}
              onChange={(e) => e.target.value && setSelectedDay(e.target.value)}
            />
            <button
              className="dash-nav-btn"
              aria-label="后一天"
              disabled={isFutureDay}
              onClick={() => setSelectedDay(addDays(selectedDay, 1))}
            >
              ›
            </button>
            {selectedDay !== today && (
              <button className="text-btn" onClick={() => setSelectedDay(today)}>
                今天
              </button>
            )}
          </div>
        </div>
        <div className="stat-counts">
          <div className="stat-count">
            <span className="stat-count-num">{daySnapshot.sessions}</span>
            <span className="stat-count-label">专注次数</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num" style={{ color: 'var(--accent)' }}>
              {formatDurationCompact(daySnapshot.seconds)}
            </span>
            <span className="stat-count-label">专注时长</span>
          </div>
        </div>
        <p className="stat-hint">{selectedDay === today ? '今日专注快照' : `回溯 ${selectedDay} 的专注记录`}</p>
      </section>

      {/* 模块 3：专注时长分布（饼图） */}
      <section className="stats-card">
        <div className="stats-card-head-row">
          <h3 className="stats-card-title">专注时长分布</h3>
          <div className="view-tabs">
            {(
              [
                ['day', '日'],
                ['week', '周'],
                ['month', '月'],
                ['custom', '自定义'],
              ] as [DistMode, string][]
            ).map(([mode, label]) => (
              <button key={mode} className={distMode === mode ? 'active' : ''} onClick={() => setDistMode(mode)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {distMode === 'custom' && (
          <div className="stats-range-picker mb-3">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span>至</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
        {distRange == null ? (
          <p className="stat-hint">请选择有效的自定义日期区间（起始 ≤ 结束）</p>
        ) : slices.length === 0 ? (
          <p className="stat-hint">{distRangeLabel} 区间内暂无专注记录</p>
        ) : (
          <>
            <DonutChart slices={slices} centerLabel="区间总时长" />
            <div className="dash-detail-entry">
              <span className="dash-range-label">{distRangeLabel}</span>
              <button className="text-btn" onClick={() => setShowDetail((v) => !v)}>
                {showDetail ? '收起明细' : '查看明细'}
              </button>
            </div>
            {showDetail && (
              <div className="dash-detail-list">
                {detailRows.length === 0 ? (
                  <p className="stat-hint">区间内暂无专注记录</p>
                ) : (
                  detailRows.map((r) => (
                    <div key={r.id} className="dash-detail-row">
                      <span className="dash-detail-time">
                        {r.date} {r.time}
                      </span>
                      <span className="dash-detail-title" title={r.title}>
                        {r.title}
                      </span>
                      <span className="dash-detail-duration">{formatDurationCompact(r.seconds)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* 模块 4：月度专注时段分布（柱状图） */}
      <section className="stats-card">
        <div className="stats-card-head-row">
          <h3 className="stats-card-title">月度专注时段分布</h3>
          <MonthNav year={hourYm.year} month={hourYm.month} onChange={setHourYm} />
        </div>
        <HourBarChart hours={hourBuckets} />
        <p className="stat-hint">
          {hasHourData
            ? `最高效时段：${peakHour}:00 – ${peakHour + 1}:00（累计 ${formatDurationCompact(hourBuckets[peakHour])}）`
            : '切换月份查看各小时区间的累计专注时长'}
        </p>
      </section>

      {/* 模块 5：月度专注趋势（面积图） */}
      <section className="stats-card">
        <div className="stats-card-head-row">
          <h3 className="stats-card-title">月度专注趋势</h3>
          <MonthNav year={trendYm.year} month={trendYm.month} onChange={setTrendYm} />
        </div>
        <TrendAreaChart points={monthPoints} unit="专注" />
        <p className="stat-hint">
          {trendYm.year} 年 {trendYm.month + 1} 月累计专注 {formatDurationCompact(monthTotal)}
        </p>
      </section>

      {/* 模块 6：年度专注趋势（面积图） */}
      <section className="stats-card">
        <div className="stats-card-head-row">
          <h3 className="stats-card-title">年度专注趋势</h3>
          <YearNav year={trendYear} onChange={setTrendYear} />
        </div>
        <TrendAreaChart points={yearPoints} unit="专注" />
        <p className="stat-hint">{trendYear} 年累计专注 {formatDurationCompact(yearTotal)}</p>
      </section>

      <p className="dash-section-title">任务统计</p>

      <section className="stats-card">
        <h3 className="stats-card-title">任务完成率</h3>
        <RateRow label="今日" completion={stats.today} />
        <RateRow label="本周" completion={stats.week} />
        <RateRow label="累计" completion={stats.cumulative} sub="（任务级）" />
      </section>

      <section className="stats-card">
        <h3 className="stats-card-title">连续打卡</h3>
        <div className="stat-streak">
          <span className="stat-streak-num">{stats.streak}</span>
          <span className="stat-streak-unit">天</span>
        </div>
        <p className="stat-hint">从今天往前，每天至少完成一个任务的连续天数</p>
      </section>

      <section className="stats-card">
        <h3 className="stats-card-title">习惯连续打卡</h3>
        <div className="stat-streak">
          <span className="stat-streak-num">{maxHabitStreak}</span>
          <span className="stat-streak-unit">天</span>
        </div>
        <p className="stat-hint">所有习惯中最长的连续打卡天数（共 {habits.length} 个习惯）</p>
        {habitStreaks.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {habitStreaks.slice(0, 5).map((h) => (
              <div key={h.title} className="flex items-center justify-between text-xs">
                <span className="truncate" style={{ color: 'var(--text)' }}>
                  {h.title}
                </span>
                <span style={{ color: 'var(--accent)' }}>{h.streak} 天</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stats-card">
        <h3 className="stats-card-title">任务计数</h3>
        <div className="stat-counts">
          <div className="stat-count">
            <span className="stat-count-num">{stats.counts.total}</span>
            <span className="stat-count-label">总任务</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num" style={{ color: 'var(--accent)' }}>
              {stats.counts.done}
            </span>
            <span className="stat-count-label">已完成</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num" style={{ color: 'var(--priority-medium)' }}>
              {stats.counts.pending}
            </span>
            <span className="stat-count-label">进行中</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num" style={{ color: 'var(--text-muted)' }}>
              {stats.counts.abandoned}
            </span>
            <span className="stat-count-label">已放弃</span>
          </div>
        </div>
      </section>

      <section className="stats-card">
        <h3 className="stats-card-title">优先级分布</h3>
        {ALL_PRIORITIES.map((p: Priority) => (
          <Bar
            key={p}
            label={PRIORITY_LABELS[p]}
            value={stats.priorityDistribution[p]}
            max={priorityMax}
            color={`var(--priority-${p})`}
          />
        ))}
      </section>

      <section className="stats-card">
        <h3 className="stats-card-title">分类分布</h3>
        {categoryEntries.length === 0 ? (
          <p className="stat-hint">暂无分类数据</p>
        ) : (
          categoryEntries.map(([category, count]) => (
            <Bar key={category} label={category} value={count} max={categoryMax} color="var(--accent)" />
          ))
        )}
      </section>
    </div>
  )
}
