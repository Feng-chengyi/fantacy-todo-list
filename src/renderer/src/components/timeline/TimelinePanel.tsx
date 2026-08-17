/**
 * v3.1 时间轴页重设计（N2）：
 * - 三视图切换：日（默认，C3）/ 周（7 日热力条）/ 月（日历热力图）；
 * - 日视图：当日专注会话时长条（相对当日最长会话）+ 操作流水；
 * - 数据源：sessions（专注）+ activities（操作记录），点击周/月日期下钻到日视图。
 */
import { useMemo, useState } from 'react'
import type { ActivityLog } from '../../../../shared/types'
import { FREE_FOCUS_LABEL } from '../../../../shared/stats'
import { sessionLocalDate } from '../../../../shared/focus'
import { groupSessionsByDate, sessionRangeLabel, summarizeDay } from '../../../../shared/sessionView'
import { formatDurationCompact } from '../../../../shared/time'
import {
  currentYearMonth,
  daysInMonth,
  leadingBlanks,
  shiftMonth,
  todayStr,
  weekDates,
} from '../../../../shared/date'
import { useConfigStore } from '../../stores/configStore'
import { useTaskStore } from '../../stores/taskStore'
import { EmptyState } from '../common/EmptyState'

type TlView = 'day' | 'week' | 'month'

const TYPE_META: Record<ActivityLog['type'], { icon: string; label: string }> = {
  create: { icon: '✚', label: '新增' },
  complete: { icon: '✅', label: '完成' },
  reopen: { icon: '↩️', label: '撤销完成' },
  delete: { icon: '🗑', label: '删除' },
  timer: { icon: '⏱', label: '计时' },
  move: { icon: '🗂', label: '归类' },
  edit: { icon: '✏️', label: '编辑' },
  checkin: { icon: '🔥', label: '打卡' },
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function localDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dateLabel(date: string): string {
  const today = todayStr()
  if (date === today) return '今天'
  const d = new Date(`${date}T00:00:00`)
  const t = new Date(`${today}T00:00:00`)
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000)
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 热力强度分级：0 无记录；1-4 随当日专注时长相对月峰值递增 */
function heatLevel(sec: number, maxSec: number): number {
  if (sec <= 0) return 0
  if (maxSec <= 0) return 1
  const ratio = sec / maxSec
  if (ratio >= 0.99) return 4
  if (ratio >= 0.6) return 3
  if (ratio >= 0.3) return 2
  return 1
}

export function TimelinePanel() {
  const activities = useTaskStore((s) => s.activities)
  const sessions = useTaskStore((s) => s.sessions)
  const tasks = useTaskStore((s) => s.tasks)
  const weekStart = useConfigStore((s) => s.weekStart)

  const today = todayStr()
  const [view, setView] = useState<TlView>('day')
  const [dayDate, setDayDate] = useState(today)
  const [ym, setYm] = useState(currentYearMonth())

  // 会话按日分组 + 任务标题映射（时长条数据源）
  const sessionsByDate = useMemo(() => groupSessionsByDate(sessions), [sessions])
  const titleById = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks])
  const activityCountByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of activities) {
      const d = localDate(a.createdAt)
      map.set(d, (map.get(d) ?? 0) + 1)
    }
    return map
  }, [activities])

  const daySessions = sessionsByDate.get(dayDate) ?? []
  const dayMaxSec = daySessions.reduce((m, s) => Math.max(m, s.durationSec), 0)
  const daySummary = useMemo(() => summarizeDay(sessions, dayDate), [sessions, dayDate])
  const dayCompletes = useMemo(
    () => activities.filter((a) => a.type === 'complete' && localDate(a.createdAt) === dayDate).length,
    [activities, dayDate],
  )
  const dayActivities = useMemo(
    () =>
      activities
        .filter((a) => localDate(a.createdAt) === dayDate)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activities, dayDate],
  )

  // 周视图数据：7 天（weekStart 决定起始日）
  const week = useMemo(() => weekDates(dayDate, weekStart), [dayDate, weekStart])
  const weekRows = useMemo(
    () =>
      week.map((date) => {
        const summary = summarizeDay(sessions, date)
        return { date, summary, records: activityCountByDate.get(date) ?? 0 }
      }),
    [week, sessions, activityCountByDate],
  )
  const weekMaxSec = weekRows.reduce((m, r) => Math.max(m, r.summary.totalSec), 0)

  // 月视图数据：热力图（专注时长强度 + 记录数提示）
  const monthDays = useMemo(() => daysInMonth(ym.year, ym.month), [ym])
  const monthSecByDate = useMemo(() => {
    const prefix = `${ym.year}-${String(ym.month + 1).padStart(2, '0')}`
    const map = new Map<string, number>()
    for (const s of sessions) {
      const d = sessionLocalDate(s.startedAt)
      if (!d.startsWith(prefix)) continue
      map.set(d, (map.get(d) ?? 0) + s.durationSec)
    }
    return map
  }, [sessions, ym])
  const monthMaxSec = monthSecByDate.size > 0 ? Math.max(...monthSecByDate.values()) : 0
  const blanks = useMemo(() => leadingBlanks(ym.year, ym.month, weekStart), [ym, weekStart])

  const hasAnyData = activities.length > 0 || sessions.length > 0

  const gotoDay = (date: string): void => {
    setDayDate(date)
    setView('day')
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="tl-head-row">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-bold">时间轴</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            专注与操作记录
          </span>
        </div>
        <div className="view-tabs">
          {(
            [
              ['day', '日'],
              ['week', '周'],
              ['month', '月'],
            ] as [TlView, string][]
          ).map(([v, label]) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasAnyData ? (
        <EmptyState
          icon="🗓"
          title="时间轴还是一片空白"
          desc="完成待办、开始计时后，这里会以热力图和时长条展示你的每一天。"
          petState="empty"
        />
      ) : view === 'day' ? (
        <>
          {/* 日视图：日期导航 + 摘要 */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="dash-nav">
              <button className="dash-nav-btn" aria-label="前一天" onClick={() => setDayDate(addDaysLocal(dayDate, -1))}>
                ‹
              </button>
              <input
                className="dash-nav-date"
                type="date"
                value={dayDate}
                onChange={(e) => e.target.value && setDayDate(e.target.value)}
              />
              <button
                className="dash-nav-btn"
                aria-label="后一天"
                onClick={() => setDayDate(addDaysLocal(dayDate, 1))}
              >
                ›
              </button>
              {dayDate !== today && (
                <button className="text-btn" onClick={() => setDayDate(today)}>
                  今天
                </button>
              )}
            </div>
          </div>
          <div className="tl-day-summary summary-chips" style={{ marginBottom: 14 }}>
            <div className="summary-chip">
              <span className="summary-chip-icon">⏱</span>
              <span className="summary-chip-num">{daySummary.count}</span>
              <span className="summary-chip-label">
                专注次数
                <span>{dateLabel(dayDate)}</span>
              </span>
            </div>
            <div className="summary-chip">
              <span className="summary-chip-icon">🕐</span>
              <span className="summary-chip-num">{formatDurationCompact(daySummary.totalSec)}</span>
              <span className="summary-chip-label">专注时长</span>
            </div>
            <div className="summary-chip">
              <span className="summary-chip-icon">✅</span>
              <span className="summary-chip-num">{dayCompletes}</span>
              <span className="summary-chip-label">完成事项</span>
            </div>
            <div className="summary-chip">
              <span className="summary-chip-icon">📝</span>
              <span className="summary-chip-num">{dayActivities.length}</span>
              <span className="summary-chip-label">操作记录</span>
            </div>
          </div>

          {/* 当日专注时长条（相对当日最长会话） */}
          {daySessions.length > 0 && (
            <>
              <div className="activity-group-head">
                <span className="activity-group-label">专注时段</span>
                <span className="activity-group-count">{daySessions.length} 段</span>
              </div>
              <div className="tl-session-list">
                {daySessions.map((s) => (
                  <div key={s.id} className="tl-session-row">
                    <div className="tl-session-main">
                      <div className="tl-session-title-row">
                        <span className="tl-session-title">{s.taskId ? (titleById.get(s.taskId) ?? '已删除任务') : FREE_FOCUS_LABEL}</span>
                        <span className="tl-session-range">{sessionRangeLabel(s)}</span>
                      </div>
                      <div className="tl-session-bar-track">
                        <div
                          className="tl-session-bar-fill"
                          style={{ width: `${dayMaxSec > 0 ? Math.max(4, Math.round((s.durationSec / dayMaxSec) * 100)) : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="tl-session-duration">{formatDurationCompact(s.durationSec)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 当日操作流水 */}
          {dayActivities.length > 0 ? (
            <div className="mb-2">
              <div className="activity-group-head">
                <span className="activity-group-label">{dateLabel(dayDate)} · 操作记录</span>
                <span className="activity-group-count">{dayActivities.length} 条</span>
              </div>
              {dayActivities.map((entry) => {
                const meta = TYPE_META[entry.type]
                return (
                  <div key={entry.id} className="activity-row">
                    <span className="activity-icon" title={meta.label}>
                      {meta.icon}
                    </span>
                    <div className="activity-main">
                      <span className="activity-title">
                        {meta.label} · {entry.taskTitle}
                      </span>
                      {entry.detail && <span className="activity-detail">{entry.detail}</span>}
                    </div>
                    <span className="activity-time">{localTime(entry.createdAt)}</span>
                  </div>
                )
              })}
            </div>
          ) : daySessions.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {dateLabel(dayDate)}暂无专注与操作记录
            </div>
          ) : null}
        </>
      ) : view === 'week' ? (
        <>
          <div className="mb-3 flex items-center gap-2">
            <div className="dash-nav">
              <button className="dash-nav-btn" aria-label="上一周" onClick={() => setDayDate(addDaysLocal(dayDate, -7))}>
                ‹
              </button>
              <span className="dash-nav-label" style={{ minWidth: 150 }}>
                {week[0].slice(5)} ~ {week[6].slice(5)}
              </span>
              <button className="dash-nav-btn" aria-label="下一周" onClick={() => setDayDate(addDaysLocal(dayDate, 7))}>
                ›
              </button>
              {!(dayDate >= week[0] && dayDate <= week[6]) && (
                <button className="text-btn" onClick={() => setDayDate(today)}>
                  本周
                </button>
              )}
            </div>
          </div>
          <div className="tl-week-grid">
            {weekRows.map((r) => {
              const weekday = WEEKDAY_LABELS[new Date(`${r.date}T00:00:00`).getDay()]
              const isToday = r.date === today
              return (
                <button
                  key={r.date}
                  className={`tl-week-day ${isToday ? 'today' : ''}`}
                  title={`${r.date}：专注 ${formatDurationCompact(r.summary.totalSec)} · ${r.summary.count} 次 · 记录 ${r.records} 条（点击查看当日详情）`}
                  onClick={() => gotoDay(r.date)}
                >
                  <div className="tl-week-day-head">
                    <span className="tl-week-label">
                      周{weekday}
                      {isToday ? ' ·今天' : ''}
                    </span>
                    <span className="tl-week-date">{r.date.slice(8)}</span>
                  </div>
                  <div className="tl-week-bar-track">
                    <div
                      className="tl-week-bar-fill"
                      style={{ width: `${weekMaxSec > 0 && r.summary.totalSec > 0 ? Math.max(4, Math.round((r.summary.totalSec / weekMaxSec) * 100)) : 0}%` }}
                    />
                  </div>
                  <div className="tl-week-meta">
                    <b>{r.summary.totalSec > 0 ? formatDurationCompact(r.summary.totalSec) : '—'}</b>
                    <span>{r.records} 条</span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="dash-nav">
              <button className="dash-nav-btn" aria-label="上一月" onClick={() => setYm(shiftMonth(ym.year, ym.month, -1))}>
                ‹
              </button>
              <span className="dash-nav-label">
                {ym.year} 年 {ym.month + 1} 月
              </span>
              <button className="dash-nav-btn" aria-label="下一月" onClick={() => setYm(shiftMonth(ym.year, ym.month, 1))}>
                ›
              </button>
              {(ym.year !== currentYearMonth().year || ym.month !== currentYearMonth().month) && (
                <button className="text-btn" onClick={() => setYm(currentYearMonth())}>
                  本月
                </button>
              )}
            </div>
            <div className="tl-heat-legend">
              少
              <i />
              <i data-level="1" />
              <i data-level="2" />
              <i data-level="3" />
              <i data-level="4" />
              多
            </div>
          </div>
          <div className="tl-heatmap-weekdays">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>{WEEKDAY_LABELS[(i + weekStart) % 7]}</span>
            ))}
          </div>
          <div className="tl-heatmap">
            {Array.from({ length: blanks }, (_, i) => (
              <span key={`blank-${i}`} className="tl-heat-cell blank" />
            ))}
            {monthDays.map((date) => {
              const sec = monthSecByDate.get(date) ?? 0
              const records = activityCountByDate.get(date) ?? 0
              return (
                <button
                  key={date}
                  className={`tl-heat-cell ${date === today ? 'today' : ''}`}
                  data-level={heatLevel(sec, monthMaxSec)}
                  title={`${date}：专注 ${formatDurationCompact(sec)} · 记录 ${records} 条（点击查看当日详情）`}
                  onClick={() => gotoDay(date)}
                >
                  {Number(date.slice(8))}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** YYYY-MM-DD ± N 天（本地时区） */
function addDaysLocal(dateStr: string, amount: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + amount)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
