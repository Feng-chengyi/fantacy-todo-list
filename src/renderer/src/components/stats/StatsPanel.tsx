/**
 * 统计看板（专注数据分析仪表盘 + 任务统计）。
 * 仪表盘信息层级：宏观总览 → 单日快照 → 分类拆解 → 时段洞察 → 中长期趋势，
 * 图表全部自绘 SVG（DonutChart / HourBarChart / TrendAreaChart），深浅色主题经 CSS 变量适配。
 * 数据基于 tasks + overrides + sessions + habits（Zustand store），随 store 实时更新。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Priority } from '../../../../shared/types'
import { ALL_PRIORITIES, PRIORITY_LABELS } from '../../../../shared/defaults'
import {
  categoryFocusSplit,
  computeFocusSummary,
  computeStats,
  currentFocusStreak,
  dailyFocusSnapshot,
  FREE_FOCUS_LABEL,
  hourlyFocusDistribution,
  maxFocusStreak,
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
import { sessionLocalDate } from '../../../../shared/focus'
import { INBOX_ID } from '../../../../shared/collections'
import { useConfigStore } from '../../stores/configStore'
import { useTaskStore } from '../../stores/taskStore'
import { DonutChart } from './DonutChart'
import { HourBarChart } from './HourBarChart'
import { TrendAreaChart } from './TrendAreaChart'
import { ConfirmDialog } from './ConfirmDialog'
import { ClearRangeDialog } from './ClearRangeDialog'

/** 待二次确认的清除操作（单条 / 全部重置；周期清除走 ClearRangeDialog） */
type PendingClear = { kind: 'session'; id: string; label: string } | { kind: 'reset' }

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

/**
 * 视图状态会话级持久（F5）：统计维度 / 当日快照 / 分布粒度在切页再回来后保持，
 * 不再每天重置为默认（模块级对象随应用生命周期存活）。
 */
const viewMemory: { scopeId: string; selectedDay: string; distMode: DistMode } = {
  scopeId: '',
  selectedDay: '',
  distMode: 'day',
}

/** ISO 时刻 → 本地 HH:mm */
function timeOf(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function StatsPanel() {
  const tasks = useTaskStore((s) => s.tasks)
  const overrides = useTaskStore((s) => s.overrides)
  const sessions = useTaskStore((s) => s.sessions)
  const collections = useTaskStore((s) => s.collections)
  const weekStart = useConfigStore((s) => s.weekStart)
  const deleteFocusSession = useTaskStore((s) => s.deleteFocusSession)
  const clearFocusSessions = useTaskStore((s) => s.clearFocusSessions)
  const resetFocusStats = useTaskStore((s) => s.resetFocusStats)

  const today = todayStr()

  /* ---- v3 统计维度：全局 / 指定待办集（过滤任务与专注会话；F5 会话级持久） ---- */
  const [scopeId, setScopeIdState] = useState(viewMemory.scopeId)
  const setScopeId = (v: string): void => {
    viewMemory.scopeId = v
    setScopeIdState(v)
  }
  const scopedTasks = useMemo(
    () => (scopeId ? tasks.filter((t) => (t.collectionId ?? INBOX_ID) === scopeId) : tasks),
    [tasks, scopeId],
  )
  const scopedSessions = useMemo(() => {
    if (!scopeId) return sessions
    const ids = new Set(scopedTasks.map((t) => t.id))
    return sessions.filter((s) => !s.taskId || ids.has(s.taskId))
  }, [sessions, scopeId, scopedTasks])

  /* ---- 数据清除（数据管理菜单 + 二次确认；删除后图表随 store 实时刷新） ---- */
  const [menuOpen, setMenuOpen] = useState(false)
  const [clearRangeOpen, setClearRangeOpen] = useState(false)
  const [pendingClear, setPendingClear] = useState<PendingClear | null>(null)
  const [clearBusy, setClearBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // 点击菜单外部关闭「数据管理」下拉
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const executeClear = async (): Promise<void> => {
    if (!pendingClear) return
    setClearBusy(true)
    try {
      if (pendingClear.kind === 'session') await deleteFocusSession(pendingClear.id)
      else await resetFocusStats()
      setPendingClear(null)
    } finally {
      setClearBusy(false)
    }
  }

  const executeClearRange = async (from: string, to: string): Promise<void> => {
    setClearBusy(true)
    try {
      await clearFocusSessions(from, to)
      setClearRangeOpen(false)
    } finally {
      setClearBusy(false)
    }
  }

  /* ---- 模块 1：累计专注汇总（自定义起始时间范围，空 = 全部历史） ---- */
  const [focusFrom, setFocusFrom] = useState('')
  const focusSummary = useMemo(
    () => computeFocusSummary(scopedSessions, focusFrom ? { from: focusFrom } : undefined),
    [scopedSessions, focusFrom],
  )

  /* ---- 模块 2：当日专注（左右箭头回溯历史单日；F5 会话级持久） ---- */
  const [selectedDay, setSelectedDayState] = useState(viewMemory.selectedDay || today)
  const setSelectedDay = (v: string): void => {
    viewMemory.selectedDay = v
    setSelectedDayState(v)
  }
  const daySnapshot = useMemo(() => dailyFocusSnapshot(scopedSessions, selectedDay), [scopedSessions, selectedDay])
  const isFutureDay = selectedDay >= today

  /* ---- 模块 3：专注时长分布饼图（日 / 周 / 月 / 自定义 + 明细入口；F5 会话级持久） ---- */
  const [distMode, setDistModeState] = useState<DistMode>(viewMemory.distMode)
  const setDistMode = (v: DistMode): void => {
    viewMemory.distMode = v
    setDistModeState(v)
  }
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
    () => (distRange ? categoryFocusSplit(scopedSessions, scopedTasks, distRange.from, distRange.to) : []),
    [scopedSessions, scopedTasks, distRange],
  )

  const titleById = useMemo(() => new Map(scopedTasks.map((t) => [t.id, t.title])), [scopedTasks])
  const detailRows = useMemo(() => {
    if (!distRange || !showDetail) return []
    return scopedSessions
      .filter((s) => {
        const dateStr = sessionLocalDate(s.startedAt)
        return dateStr >= distRange.from && dateStr <= distRange.to
      })
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .map((s) => ({
        id: s.id,
        date: sessionLocalDate(s.startedAt),
        time: timeOf(s.startedAt),
        title: s.taskId ? (titleById.get(s.taskId) ?? '已删除任务') : FREE_FOCUS_LABEL,
        seconds: s.durationSec,
      }))
  }, [scopedSessions, distRange, showDetail, titleById])

  /* ---- 模块 4：月度专注时段分布（24 小时柱状图，月份切换；洞察升级为 Top3 时段） ---- */
  const [hourYm, setHourYm] = useState(nowYm)
  const hourBuckets = useMemo(
    () => hourlyFocusDistribution(scopedSessions, hourYm.year, hourYm.month),
    [scopedSessions, hourYm],
  )
  const peakHour = hourBuckets.reduce((best, sec, h) => (sec > hourBuckets[best] ? h : best), 0)
  const hasHourData = hourBuckets[peakHour] > 0
  /** 当月累计专注时长最长的前 3 个小时区间（N6 高效时段洞察） */
  const topHours = useMemo(
    () =>
      hourBuckets
        .map((sec, h) => ({ sec, h }))
        .filter((x) => x.sec > 0)
        .sort((a, b) => b.sec - a.sec)
        .slice(0, 3),
    [hourBuckets],
  )

  /* ---- 模块 5：月度专注趋势（面积图，月份切换） ---- */
  const [trendYm, setTrendYm] = useState(nowYm)
  const monthPoints = useMemo(
    () =>
      monthlyDailyTrend(scopedSessions, trendYm.year, trendYm.month).map((p) => ({
        label: `${p.day}日`,
        seconds: p.seconds,
      })),
    [scopedSessions, trendYm],
  )
  const monthTotal = monthPoints.reduce((sum, p) => sum + p.seconds, 0)

  /* ---- 模块 6：年度专注趋势（面积图，年份切换） ---- */
  const [trendYear, setTrendYear] = useState(nowYm.year)
  const yearPoints = useMemo(
    () => yearlyMonthlyTrend(scopedSessions, trendYear).map((p) => ({ label: p.label, seconds: p.seconds })),
    [scopedSessions, trendYear],
  )
  const yearTotal = yearPoints.reduce((sum, p) => sum + p.seconds, 0)

  /* ---- 任务统计（原有） ---- */
  const stats = useMemo(() => computeStats(scopedTasks, overrides, { weekStart }), [scopedTasks, overrides, weekStart])
  const habitTasks = useMemo(() => scopedTasks.filter((t) => (t.taskType ?? 'normal') === 'habit'), [scopedTasks])
  const habitStreaks = useMemo(() => {
    return habitTasks
      .map((t) => ({ title: t.title, streak: streakOf({ id: t.id, title: t.title, checkins: t.habitCheckins ?? [] }, today) }))
      .sort((a, b) => b.streak - a.streak)
  }, [habitTasks, today])
  const maxHabitStreak = habitStreaks.reduce((m, x) => Math.max(m, x.streak), 0)

  /* ---- v3.1 亮点卡指标（N6）：sessions 维度的当前 / 最长连续专注天数 ---- */
  const focusStreakNow = useMemo(() => currentFocusStreak(scopedSessions, today), [scopedSessions, today])
  const focusStreakMax = useMemo(() => maxFocusStreak(scopedSessions), [scopedSessions])
  const todayPct = pct(stats.today.done, stats.today.total)

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
      <div className="stats-head-row">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold">统计看板</h2>
          {/* v3 统计维度：全局 / 指定待办集 */}
          <select
            className="select"
            style={{ height: 28, fontSize: 12 }}
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            title="统计维度"
          >
            <option value="">全局统计</option>
            {collections
              .slice()
              .sort((a, b) => (a.isSystem === b.isSystem ? a.sortOrder - b.sortOrder : a.isSystem ? -1 : 1))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isSystem ? '📥 ' : ''}
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div className="stats-more-wrap" ref={menuRef}>
          <button className="text-btn" onClick={() => setMenuOpen((v) => !v)} title="统计数据管理">
            ⋯ 数据管理
          </button>
          {menuOpen && (
            <div className="stats-more-menu">
              <button
                className="stats-more-item"
                onClick={() => {
                  setMenuOpen(false)
                  setClearRangeOpen(true)
                }}
              >
                清空指定周期数据…
              </button>
              <button
                className="stats-more-item danger"
                onClick={() => {
                  setMenuOpen(false)
                  setPendingClear({ kind: 'reset' })
                }}
              >
                重置全部统计数据…
              </button>
            </div>
          )}
        </div>
      </div>

      {/* v3.1 亮点卡（N6 决策 C4）：页面第一视觉元素，一眼看到今日成果与连续性 */}
      <section className="stats-highlight">
        <div className="stats-highlight-item" title="今日到期实例的完成率（重复任务按单日展开）">
          <span className="stats-highlight-icon">✅</span>
          <span className="stats-highlight-num plain">{todayPct}%</span>
          <span className="stats-highlight-label">今日完成率</span>
        </div>
        <div className="stats-highlight-item" title="每天至少完成一个任务的连续天数">
          <span className="stats-highlight-icon">🔥</span>
          <span className="stats-highlight-num">{stats.streak}</span>
          <span className="stats-highlight-label">连续打卡 / 天</span>
        </div>
        <div className="stats-highlight-item" title="有专注记录的连续天数（历史最长）">
          <span className="stats-highlight-icon">⏱</span>
          <span className="stats-highlight-num">{focusStreakMax}</span>
          <span className="stats-highlight-label">最长连续专注 / 天</span>
        </div>
        <div className="stats-highlight-item" title={`当前连续专注 ${focusStreakNow} 天；累计专注总时长`}>
          <span className="stats-highlight-icon">🕐</span>
          <span className="stats-highlight-num plain">{formatDurationCompact(focusSummary.totalSeconds)}</span>
          <span className="stats-highlight-label">累计专注</span>
        </div>
      </section>

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
                      <button
                        className="dash-detail-del"
                        title="删除该记录"
                        disabled={clearBusy}
                        onClick={() =>
                          setPendingClear({
                            kind: 'session',
                            id: r.id,
                            label: `${r.date} ${r.time} · ${r.title}（${formatDurationCompact(r.seconds)}）`,
                          })
                        }
                      >
                        ✕
                      </button>
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
            ? `最常专注时段：${topHours
                .map((x) => `${String(x.h).padStart(2, '0')}:00–${String(x.h + 1).padStart(2, '0')}`)
                .join(' · ')}（当月累计，峰值 ${formatDurationCompact(hourBuckets[peakHour])}）`
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
        <p className="stat-hint">所有习惯任务中最长的连续打卡天数（共 {habitTasks.length} 个习惯）</p>
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

      {/* 数据清除弹层：周期清除（两步）+ 单条/全部重置（二次确认） */}
      {clearRangeOpen && (
        <ClearRangeDialog busy={clearBusy} onConfirm={executeClearRange} onCancel={() => setClearRangeOpen(false)} />
      )}
      {pendingClear?.kind === 'session' && (
        <ConfirmDialog
          title="删除该专注记录"
          detail={pendingClear.label}
          busy={clearBusy}
          onConfirm={() => void executeClear()}
          onCancel={() => setPendingClear(null)}
        />
      )}
      {pendingClear?.kind === 'reset' && (
        <ConfirmDialog
          title="重置全部统计数据"
          detail="将清空所有历史专注记录，累计时长、日均时长与全部图表归零。"
          confirmLabel="全部重置"
          busy={clearBusy}
          onConfirm={() => void executeClear()}
          onCancel={() => setPendingClear(null)}
        />
      )}
    </div>
  )
}
