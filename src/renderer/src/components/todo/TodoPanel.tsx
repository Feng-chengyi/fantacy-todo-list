/**
 * v3 待办首页（默认首页）：全量任务仓库（桌面原生行列表）。
 * 顶部：状态筛选（全部/未完成/已完成）+ 类型筛选（全部/普通/习惯/目标）+ 新建 + 快捷计时；
 * 默认展示未完成任务；今日专注统计栏保留。
 */
import { useMemo } from 'react'
import { buildTaskRepository } from '../../../../shared/listView'
import { sessionLocalDate } from '../../../../shared/focus'
import { summarizeDay } from '../../../../shared/sessionView'
import { formatDurationCompact } from '../../../../shared/time'
import { todayStr } from '../../../../shared/date'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore, type TaskFilter, type TaskTypeFilter } from '../../stores/uiStore'
import { TaskRepoRow } from './TaskRepoRow'
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

  // 今日统计栏：次数 + 总时长（含自由计时，均为已落库会话）
  const todaySummary = useMemo(() => summarizeDay(sessions, today), [sessions, today])

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
          <button className="quick-timer-btn" onClick={() => void quickTimer()} title="在收集箱生成临时任务并开始计时">
            ⚡ 快捷计时
          </button>
          <button className="primary-btn" onClick={() => openCreate(today)}>
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

      <div className="repo-stats-bar mb-3">
        <span>
          今日专注：<b>{todaySummary.count}</b> 次
        </span>
        <span className="repo-stats-divider" />
        <span>
          累计 <b>{formatDurationCompact(todaySummary.totalSec)}</b>
        </span>
      </div>

      {repo.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          暂无待办任务，点击右上角「新建任务」开始
        </div>
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
