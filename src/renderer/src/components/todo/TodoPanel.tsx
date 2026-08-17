/**
 * 待办首页（默认首页）：常驻任务仓库（桌面原生行列表）。
 * 每个任务仅一行（周期/习惯任务不展开、不预生成未来日期任务行）；
 * 顶部为今日专注统计栏；历史专注记录归时间轴页面回看。
 */
import { useMemo } from 'react'
import { buildTaskRepository } from '../../../../shared/listView'
import { sessionLocalDate } from '../../../../shared/focus'
import { summarizeDay } from '../../../../shared/sessionView'
import { formatDurationCompact } from '../../../../shared/time'
import { todayStr } from '../../../../shared/date'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { TaskRepoRow } from './TaskRepoRow'

export function TodoPanel() {
  const tasks = useTaskStore((s) => s.tasks)
  const sessions = useTaskStore((s) => s.sessions)
  const filter = useUiStore((s) => s.filter)
  const openCreate = useUiStore((s) => s.openCreate)

  const today = todayStr()
  const repo = useMemo(() => buildTaskRepository(tasks, filter), [tasks, filter])

  // 今日统计栏：次数 + 总时长（含自由计时/番茄，均为已落库会话）
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
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-bold">待办</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            共 {repo.length} 项
          </span>
        </div>
        <button className="primary-btn" onClick={() => openCreate(today)}>
          新建任务
        </button>
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
