/**
 * 待办首页（默认首页）：聚焦未来任务规划场景。
 * 仅展示「已逾期（未完成）+ 今日 + 未来」任务清单与新建入口；
 * 收集箱为独立页面，日历 / 历史复盘归时间轴页面。
 * 分组口径由 shared/listView.buildTodoGroups 纯函数统一。
 */
import { useMemo } from 'react'
import { buildTodoGroups } from '../../../../shared/listView'
import { todayStr } from '../../../../shared/date'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { ListRow } from '../calendar/ListView'

export function TodoPanel() {
  const tasks = useTaskStore((s) => s.tasks)
  const overrides = useTaskStore((s) => s.overrides)
  const filter = useUiStore((s) => s.filter)
  const openCreate = useUiStore((s) => s.openCreate)

  const groups = useMemo(
    () => buildTodoGroups(tasks, overrides, filter, todayStr()),
    [tasks, overrides, filter],
  )

  const today = todayStr()
  const todayCount = groups.find((g) => g.key === today)?.occurrences.length ?? 0

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-bold">待办</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            今日 {todayCount} 项
          </span>
        </div>
        <button className="primary-btn" onClick={() => openCreate(today)}>
          新建任务
        </button>
      </div>
      {groups.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          暂无待办，点击右上角「新建任务」开始规划
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.key}>
              <div className={`list-group-head ${g.isToday ? 'today' : ''} ${g.key === 'overdue' ? 'overdue' : ''}`}>
                <span className="list-group-label">{g.label}</span>
                <span className="list-group-count">{g.occurrences.length} 项</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {g.occurrences.map((occ) => (
                  <ListRow key={`${occ.task.id}-${occ.date}`} occurrence={occ} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
