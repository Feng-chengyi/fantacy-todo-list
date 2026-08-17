/**
 * v3 时间轴页：全量任务操作记录流水（时间倒序）。
 * 记录类型：新增 / 完成 / 撤销 / 删除 / 计时 / 归类修改 / 编辑 / 打卡；
 * 支持按日期筛选；仅展示查询，不支持编辑原始数据。
 */
import { useMemo, useState } from 'react'
import type { ActivityLog } from '../../../../shared/types'
import { todayStr } from '../../../../shared/date'
import { useTaskStore } from '../../stores/taskStore'

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

interface Group {
  date: string
  label: string
  entries: ActivityLog[]
}

export function TimelinePanel() {
  const activities = useTaskStore((s) => s.activities)
  const [dateFilter, setDateFilter] = useState<string>('')

  // 时间倒序 + 按日期分组
  const groups = useMemo<Group[]>(() => {
    const filtered = dateFilter ? activities.filter((a) => localDate(a.createdAt) === dateFilter) : activities
    const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const map = new Map<string, ActivityLog[]>()
    for (const a of sorted) {
      const date = localDate(a.createdAt)
      const list = map.get(date) ?? []
      list.push(a)
      map.set(date, list)
    }
    return [...map.entries()].map(([date, entries]) => ({ date, label: dateLabel(date), entries }))
  }, [activities, dateFilter])

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-bold">时间轴</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            任务操作记录（仅展示）
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>按日期筛选</span>
          <input type="date" className="input" style={{ height: 28 }} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          {dateFilter && (
            <button className="mini-btn" onClick={() => setDateFilter('')}>
              全部
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          暂无操作记录
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.date} className="mb-2">
            <div className="activity-group-head">
              <span className="activity-group-label">{group.label}</span>
              <span className="activity-group-count">{group.entries.length} 条记录</span>
            </div>
            {group.entries.map((entry) => {
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
        ))
      )}
    </div>
  )
}
