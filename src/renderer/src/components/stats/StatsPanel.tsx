/**
 * 统计看板：今日/本周/累计完成率、连续打卡、计数、优先级/分类分布、专注统计与分布。
 * 数据基于 tasks + overrides + sessions（重复任务用 repeatEngine 展开），随 taskStore 实时更新。
 * 可视化仅用轻量进度条 + 条形图（CSS/SVG），深浅色主题经 CSS 变量适配。
 */
import { useMemo, useState } from 'react'
import type { Priority } from '../../../../shared/types'
import { ALL_PRIORITIES, PRIORITY_LABELS } from '../../../../shared/defaults'
import {
  bucketFocus,
  computeFocusSummary,
  computeStats,
  type Completion,
  type FocusGranularity,
} from '../../../../shared/stats'
import { streakOf } from '../../../../shared/habit'
import { addDays, todayStr } from '../../../../shared/date'
import { formatDurationMinutes } from '../../../../shared/time'
import { useConfigStore } from '../../stores/configStore'
import { useTaskStore } from '../../stores/taskStore'
import { useHabitStore } from '../../stores/habitStore'

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

export function StatsPanel() {
  const tasks = useTaskStore((s) => s.tasks)
  const overrides = useTaskStore((s) => s.overrides)
  const sessions = useTaskStore((s) => s.sessions)
  const weekStart = useConfigStore((s) => s.weekStart)
  const habits = useHabitStore((s) => s.habits)

  // 专注统计：起始日期筛选（空 = 全部历史）
  const [focusFrom, setFocusFrom] = useState('')
  // 专注分布：粒度 + 日期区间（默认最近 30 天）
  const [granularity, setGranularity] = useState<FocusGranularity>('day')
  const [rangeFrom, setRangeFrom] = useState(() => addDays(todayStr(), -29))
  const [rangeTo, setRangeTo] = useState(() => todayStr())

  const stats = useMemo(() => computeStats(tasks, overrides, { weekStart }), [tasks, overrides, weekStart])

  const focus = useMemo(
    () => computeFocusSummary(sessions, focusFrom ? { from: focusFrom } : undefined),
    [sessions, focusFrom],
  )
  const focusBuckets = useMemo(() => {
    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) return []
    return bucketFocus(sessions, rangeFrom, rangeTo, granularity, weekStart)
  }, [sessions, rangeFrom, rangeTo, granularity, weekStart])
  const focusBucketMax = focusBuckets.reduce((m, b) => Math.max(m, b.seconds), 0)

  // 习惯连续打卡：所有习惯中最长的连续天数（与任务完成 streak 区分展示）
  const habitStreaks = useMemo(() => {
    const today = todayStr()
    return habits
      .map((h) => ({ title: h.title, streak: streakOf(h, today) }))
      .sort((a, b) => b.streak - a.streak)
  }, [habits])
  const maxHabitStreak = habitStreaks.reduce((m, x) => Math.max(m, x.streak), 0)

  const priorityMax = Math.max(1, ...ALL_PRIORITIES.map((p) => stats.priorityDistribution[p]))
  const categoryEntries = Object.entries(stats.categoryDistribution).sort((a, b) => b[1] - a[1])
  const categoryMax = Math.max(1, ...categoryEntries.map(([, n]) => n))

  return (
    <div className="stats-panel">
      <h2 className="mb-4 text-base font-bold">统计看板</h2>

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
        <div className="stats-card-head-row">
          <h3 className="stats-card-title">专注统计</h3>
          <label className="stats-range-picker">
            <span>起始日期</span>
            <input
              type="date"
              value={focusFrom}
              onChange={(e) => setFocusFrom(e.target.value)}
            />
            {focusFrom && (
              <button className="text-btn" onClick={() => setFocusFrom('')}>
                全部
              </button>
            )}
          </label>
        </div>
        <div className="stat-counts">
          <div className="stat-count">
            <span className="stat-count-num">{focus.totalSessions}</span>
            <span className="stat-count-label">累计计时</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num" style={{ color: 'var(--accent)' }}>
              {formatDurationMinutes(focus.totalSeconds)}
            </span>
            <span className="stat-count-label">累计时长</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num">{formatDurationMinutes(focus.avgSecondsPerDay)}</span>
            <span className="stat-count-label">日均时长</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num">{focus.todaySessions}</span>
            <span className="stat-count-label">今日次数</span>
          </div>
          <div className="stat-count">
            <span className="stat-count-num" style={{ color: 'var(--accent)' }}>
              {formatDurationMinutes(focus.todaySeconds)}
            </span>
            <span className="stat-count-label">今日时长</span>
          </div>
        </div>
        <p className="stat-hint">正向计时不足 5 秒的会话不计入</p>
      </section>

      <section className="stats-card">
        <div className="stats-card-head-row">
          <h3 className="stats-card-title">专注时长分布</h3>
          <div className="stats-range-picker">
            <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
            <span>至</span>
            <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
          </div>
        </div>
        <div className="view-tabs mb-3">
          {(
            [
              ['day', '按日'],
              ['week', '按周'],
              ['month', '按月'],
            ] as [FocusGranularity, string][]
          ).map(([g, label]) => (
            <button key={g} className={granularity === g ? 'active' : ''} onClick={() => setGranularity(g)}>
              {label}
            </button>
          ))}
        </div>
        {focusBuckets.length === 0 ? (
          <p className="stat-hint">区间内暂无专注记录</p>
        ) : (
          <div className="focus-bars">
            {focusBuckets.map((b) => (
              <Bar
                key={b.key}
                label={b.label}
                value={Math.round(b.seconds / 60)}
                max={Math.max(1, Math.round(focusBucketMax / 60))}
                color="var(--accent)"
              />
            ))}
          </div>
        )}
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
