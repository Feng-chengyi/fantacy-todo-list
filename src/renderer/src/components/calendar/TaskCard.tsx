/**
 * 任务卡：优先级色条 + 标题 + 勾选；可拖拽；右键菜单。
 */
import { useDraggable } from '@dnd-kit/core'
import type { CSSProperties, MouseEvent } from 'react'
import type { Occurrence } from '../../../../shared/types'
import { fireConfetti } from '../../lib/confetti'
import { useConfigStore } from '../../stores/configStore'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'

export function TaskCard({ occurrence }: { occurrence: Occurrence }) {
  const { task, date, status } = occurrence
  const setStatus = useTaskStore((s) => s.setStatus)
  const setOverride = useTaskStore((s) => s.setOverride)
  const clearOverride = useTaskStore((s) => s.clearOverride)
  const confettiEnabled = useConfigStore((s) => s.confettiEnabled)
  const setContextMenu = useUiStore((s) => s.setContextMenu)

  // 重复任务：任何实例（含 anchor 日期）的勾选都走单实例 override（PRD P0-05 单日独立操作）
  const isRepeat = !!task.repeat
  const done = status === 'done'
  const abandoned = status === 'abandoned'

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    // 重复任务在月历上有多个实例，dnd id 必须唯一：task.id + 实例日期
    id: `${task.id}-${date}`,
    data: { occurrenceDate: date },
  })

  const style: CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.6 : 1,
  }

  const toggleDone = (e: MouseEvent) => {
    e.stopPropagation()
    if (abandoned) return
    if (isRepeat) {
      if (done) void clearOverride(task.id, date)
      else void setOverride(task.id, date, 'done')
      if (!done && confettiEnabled) fireConfetti()
    } else {
      void setStatus(task.id, done ? 'pending' : 'done')
      if (!done && confettiEnabled) fireConfetti()
    }
  }

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ task, occurrenceDate: isRepeat ? date : undefined, x: e.clientX, y: e.clientY })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={onContextMenu}
      className={`task-card ${done ? 'done' : ''} ${abandoned ? 'abandoned' : ''}`}
      title={task.title}
    >
      <span className="task-priority-bar" style={{ background: `var(--priority-${task.priority})` }} />
      <button
        className={`check ${done ? 'checked' : ''}`}
        onClick={toggleDone}
        aria-label="完成"
      >
        {done ? '✓' : ''}
      </button>
      <span className="task-title">{task.title}</span>
      {task.repeat && <span className="repeat-mark" title="重复任务">↻</span>}
    </div>
  )
}
