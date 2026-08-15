/**
 * 收集箱：未定时任务列表，支持拖拽排序 + 「安排到日历」。
 */
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import type { Task } from '../../../../shared/types'
import { taskColor } from '../../../../shared/defaults'
import { fireConfetti } from '../../lib/confetti'
import { useConfigStore } from '../../stores/configStore'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'

function InboxItem({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const setStatus = useTaskStore((s) => s.setStatus)
  const openEdit = useUiStore((s) => s.openEdit)
  const confettiEnabled = useConfigStore((s) => s.confettiEnabled)

  const done = task.status === 'done'
  const abandoned = task.status === 'abandoned'

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const toggle = (e: MouseEvent): void => {
    e.stopPropagation()
    if (abandoned) return
    void setStatus(task.id, done ? 'pending' : 'done')
    if (!done && confettiEnabled) fireConfetti()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${done ? 'done' : ''} ${abandoned ? 'abandoned' : ''}`}
    >
      <span className="task-priority-bar" style={{ background: taskColor(task) }} />
      <span className="drag-handle" title="拖拽排序">
        ⠿
      </span>
      <button className={`check ${done ? 'checked' : ''}`} onClick={toggle}>
        {done ? '✓' : ''}
      </button>
      <span className="task-title flex-1">{task.title}</span>
      <button
        className="mini-btn"
        onClick={(e) => {
          e.stopPropagation()
          openEdit(task)
        }}
      >
        安排到日历
      </button>
    </div>
  )
}

export function InboxList() {
  const allTasks = useTaskStore((s) => s.tasks)
  const reorderInbox = useTaskStore((s) => s.reorderInbox)
  const openCreate = useUiStore((s) => s.openCreate)

  const tasks = useMemo(() => allTasks.filter((t) => t.date === null), [allTasks])
  const inbox = useMemo(
    () => [...tasks].sort((a, b) => (a.inboxOrder ?? 0) - (b.inboxOrder ?? 0)),
    [tasks],
  )
  const ids = useMemo(() => inbox.map((t) => t.id), [inbox])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    void reorderInbox(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">收集箱</h2>
        <button className="primary-btn" onClick={() => openCreate(null)}>
          新建收集项
        </button>
      </div>
      {inbox.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          暂无收集项，点击右上角「新建收集项」或拖拽任务到收集箱
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {inbox.map((task) => (
                <InboxItem key={task.id} task={task} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
