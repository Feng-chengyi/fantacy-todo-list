/**
 * 列表视图：全部待办按「收集箱 + 日期分组」纵向罗列，可与卡片/日历视图切换。
 * 数据口径由 shared/listView 纯函数统一（重复任务展开近 90 天，skipped 隐藏）。
 * 行交互与任务卡一致：勾选（重复任务走单日 override）、计时、右键菜单、点击编辑。
 */
import { useMemo, type MouseEvent } from 'react'
import type { Occurrence } from '../../../../shared/types'
import { buildListGroups, type ListGroup } from '../../../../shared/listView'
import { taskColor } from '../../../../shared/defaults'
import { isSameTimerInstance } from '../../../../shared/focus'
import { formatDurationMinutes } from '../../../../shared/time'
import { todayStr } from '../../../../shared/date'
import { fireConfetti } from '../../lib/confetti'
import * as api from '../../services/ipc'
import { useConfigStore } from '../../stores/configStore'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { commitFocus, switchTimer } from '../../services/focus'
import { Stopwatch } from '../task/Stopwatch'

function ListRow({ occurrence }: { occurrence: Occurrence }) {
  const { task, date, status } = occurrence
  const setStatus = useTaskStore((s) => s.setStatus)
  const setOverride = useTaskStore((s) => s.setOverride)
  const clearOverride = useTaskStore((s) => s.clearOverride)
  const openEdit = useUiStore((s) => s.openEdit)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const openTimerPanel = useUiStore((s) => s.openTimerPanel)
  const timer = useUiStore((s) => s.timer)
  const confettiEnabled = useConfigStore((s) => s.confettiEnabled)

  const isRepeat = !!task.repeat
  const done = status === 'done'
  const abandoned = status === 'abandoned'
  // 收集箱行 date 为 ''（哨兵），计时实例日期归一为 null（非重复任务按 taskId 唯一识别）
  const occurrenceDate = date || null
  const isTiming = !!timer && isSameTimerInstance(timer, task.id, occurrenceDate)

  /** 完成时若正在对该任务实例计时，统一走 commitFocus 落库（含 5 秒下限过滤） */
  const recordDuration = (): void => {
    if (timer && isSameTimerInstance(timer, task.id, occurrenceDate)) void commitFocus()
  }

  const toggleDone = (e: MouseEvent): void => {
    e.stopPropagation()
    if (abandoned) return
    if (isRepeat) {
      if (done) void clearOverride(task.id, date)
      else {
        void setOverride(task.id, date, 'done')
        if (confettiEnabled) fireConfetti()
        recordDuration()
        void api.notifyPetAnim({ anim: 'finishing' })
      }
    } else {
      void setStatus(task.id, done ? 'pending' : 'done')
      if (!done) {
        if (confettiEnabled) fireConfetti()
        recordDuration()
        void api.notifyPetAnim({ anim: 'finishing' })
      }
    }
  }

  return (
    <div
      className={`task-card roomy list-row ${done ? 'done' : ''} ${abandoned ? 'abandoned' : ''}`}
      onClick={() => openEdit(task, isRepeat ? date : undefined)}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({ task, occurrenceDate: isRepeat ? date : undefined, x: e.clientX, y: e.clientY })
      }}
      title={task.title}
    >
      <div className="task-card-row">
        <span className="task-priority-bar" style={{ background: taskColor(task) }} />
        <button
          className={`check ${done ? 'checked' : ''}`}
          onClick={toggleDone}
          aria-label="完成"
        >
          {done ? '✓' : ''}
        </button>
        <span className="task-title">{task.title}</span>
        {task.startTime && <span className="task-time">{task.startTime}</span>}
        {task.category?.trim() && (
          <span className="task-category">
            <span className="task-category-dot" style={{ background: taskColor(task) }} />
            {task.category.trim()}
          </span>
        )}
        {task.repeat && (
          <span className="repeat-mark" title="重复任务">
            ↻
          </span>
        )}
        {task.durationSec != null && !isTiming && (
          <span className="duration-mark" title="完成用时">
            {formatDurationMinutes(task.durationSec)}
          </span>
        )}
        {isTiming ? (
          <>
            <Stopwatch taskId={task.id} occurrenceDate={occurrenceDate} />
            <button
              className="mini-btn timer-btn"
              onClick={(e) => {
                e.stopPropagation()
                void commitFocus()
              }}
              title="停止计时"
            >
              ⏹
            </button>
          </>
        ) : (
          !done &&
          !abandoned && (
            <button
              className="mini-btn timer-btn"
              onClick={(e) => {
                e.stopPropagation()
                void switchTimer(task.id, occurrenceDate)
                openTimerPanel()
              }}
              title="开始计时"
            >
              ▶
            </button>
          )
        )}
      </div>
    </div>
  )
}

export function ListView() {
  const tasks = useTaskStore((s) => s.tasks)
  const overrides = useTaskStore((s) => s.overrides)
  const filter = useUiStore((s) => s.filter)
  const openCreate = useUiStore((s) => s.openCreate)

  const groups: ListGroup[] = useMemo(
    () => buildListGroups(tasks, overrides, filter, todayStr()),
    [tasks, overrides, filter],
  )

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">任务列表</h2>
        <button className="primary-btn" onClick={() => openCreate(todayStr())}>
          新建任务
        </button>
      </div>
      {groups.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          暂无待办，点击右上角「新建任务」开始
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.key}>
              <div className={`list-group-head ${g.isToday ? 'today' : ''}`}>
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
