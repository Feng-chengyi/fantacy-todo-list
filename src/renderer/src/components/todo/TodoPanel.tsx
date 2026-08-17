/**
 * v3.1 待办首页（默认首页）：全量任务仓库（桌面原生行列表）。
 * 顶部：结构化摘要条（icon + 数字 + 短描述，N1.5）+ 筛选 + 新建 + 快捷计时；
 * 空状态：无任务引导创建 / 今日清空庆祝（N4 + N1.2 桌宠联动）。
 */
import { useMemo } from 'react'
import { buildTaskRepository } from '../../../../shared/listView'
import { computeStats } from '../../../../shared/stats'
import { sessionLocalDate } from '../../../../shared/focus'
import { summarizeDay } from '../../../../shared/sessionView'
import { formatDurationCompact } from '../../../../shared/time'
import { todayStr } from '../../../../shared/date'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore, type TaskFilter, type TaskTypeFilter } from '../../stores/uiStore'
import { TaskRepoRow } from './TaskRepoRow'
import { EmptyState } from '../common/EmptyState'
import { quickTimer } from '../../services/focus'

const STATUS_FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'pending', label: '未完成' },
  { key: 'all', label: '全部' },
  { key: 'done', label: '已完成' },
]

const TYPE_FILTERS: { key: TaskTypeFilter; label: string }[] = [
  { key: 'all', label: '全部类型' },
  { key: 'normal', label: '普通' },
  { key: 'habit', label: '习惯' },
  { key: 'goal', label: '目标' },
]

export function TodoPanel() {
  const tasks = useTaskStore((s) => s.tasks)
  const overrides = useTaskStore((s) => s.overrides)
  const sessions = useTaskStore((s) => s.sessions)
  const filter = useUiStore((s) => s.filter)
  const setFilter = useUiStore((s) => s.setFilter)
  const typeFilter = useUiStore((s) => s.typeFilter)
  const setTypeFilter = useUiStore((s) => s.setTypeFilter)
  const openCreate = useUiStore((s) => s.openCreate)

  const today = todayStr()
  const repo = useMemo(
    () => buildTaskRepository(tasks, filter).filter((t) => typeFilter === 'all' || (t.taskType ?? 'normal') === typeFilter),
    [tasks, filter, typeFilter],
  )

  // 今日统计（摘要条数据源，仅统计已落库会话）
  const todaySummary = useMemo(() => summarizeDay(sessions, today), [sessions, today])

  // 摘要条指标：待完成 / 过期 / 连续打卡（computeStats 一次算齐）
  const stats = useMemo(() => computeStats(tasks, overrides, { weekStart: 1 }), [tasks, overrides])
  const pendingCount = stats.counts.pending
  const overdueCount = useMemo(
    () => tasks.filter((t) => t.status === 'pending' && t.date && t.date < today).length,
    [tasks, today],
  )

  // 各任务今日专注秒数（进度列数据源，仅统计已落库会话）
  const todaySecByTask = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      if (s.taskId && sessionLocalDate(s.startedAt) === today) {
        map.set(s.taskId, (map.get(s.taskId) ?? 0) + s.durationSec)
      }
    }
    return map
  }, [sessions, today])

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-bold">待办</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            共 {repo.length} 项
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="quick-timer-btn"
            onClick={() => void quickTimer()}
            title="在收集箱生成临时任务并开始计时（Ctrl+Shift+T）"
          >
            ⚡ 快捷计时
          </button>
          <button className="primary-btn" onClick={() => openCreate(today)} title="新建任务（Ctrl+Shift+N）">
            新建任务
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="filter-tabs">
          {STATUS_FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="filter-tabs">
          {TYPE_FILTERS.map((f) => (
            <button key={f.key} className={typeFilter === f.key ? 'active' : ''} onClick={() => setTypeFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 结构化摘要条（N1.5）：icon + 数字 + 短描述 */}
      <div className="summary-chips">
        <div className="summary-chip" title="今日已落库的专注会话">
          <span className="summary-chip-icon">⏱</span>
          <span className="summary-chip-num">{todaySummary.count}</span>
          <span className="summary-chip-label">
            今日专注
            <span>累计 {formatDurationCompact(todaySummary.totalSec)}</span>
          </span>
        </div>
        <div className="summary-chip" title="进行中的任务数">
          <span className="summary-chip-icon">📋</span>
          <span className="summary-chip-num">{pendingCount}</span>
          <span className="summary-chip-label">
            待完成
            <span>今日目标 {stats.today.done}/{stats.today.total}</span>
          </span>
        </div>
        <div className={`summary-chip ${overdueCount > 0 ? 'warn' : ''}`} title="已过截止日仍未完成的任务">
          <span className="summary-chip-icon">⚠️</span>
          <span className="summary-chip-num">{overdueCount}</span>
          <span className="summary-chip-label">
            已过期
            <span>{overdueCount > 0 ? '需要关注' : '一切正常'}</span>
          </span>
        </div>
        <div className="summary-chip" title="每天至少完成一个任务的连续天数">
          <span className="summary-chip-icon">🔥</span>
          <span className="summary-chip-num">{stats.streak}</span>
          <span className="summary-chip-label">
            连续打卡
            <span>天</span>
          </span>
        </div>
      </div>

      {repo.length === 0 ? (
        tasks.length === 0 ? (
          <EmptyState
            icon="📝"
            title="从这里开始你的第一步"
            desc="暂无待办任务，点击右上角「新建任务」开始；也可以用 ⚡ 快捷计时立即进入专注。"
            action={{ label: '新建任务', onClick: () => openCreate(today) }}
            petState="empty"
          />
        ) : filter === 'pending' && typeFilter === 'all' ? (
          // 有任务但无未完成：今日清空庆祝态（N4 + 桌宠联动）
          <EmptyState
            icon="🎉"
            title="太棒了，任务全部完成！"
            desc="未完成列表已清空。休息一下，或提前规划明天的安排。"
            petState="all-done"
          />
        ) : (
          <EmptyState
            icon="🔍"
            title="没有符合筛选的任务"
            desc="当前筛选组合下暂无任务，试试切换状态或类型筛选。"
          />
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          {repo.map((task) => (
            <TaskRepoRow key={task.id} task={task} todaySec={todaySecByTask.get(task.id) ?? 0} />
          ))}
        </div>
      )}
    </div>
  )
}
