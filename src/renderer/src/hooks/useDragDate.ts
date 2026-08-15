/**
 * 日历拖拽改期逻辑：落点高亮 + onDragEnd 改期/实例搬迁。
 */
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { useTaskStore } from '../stores/taskStore'
import { useUiStore } from '../stores/uiStore'

const DAY_PREFIX = 'day-'
const DATE_LEN = 10 // YYYY-MM-DD 固定长度

export function dayDropId(date: string): string {
  return `${DAY_PREFIX}${date}`
}

export function parseDayDropId(id: string): string | null {
  return id.startsWith(DAY_PREFIX) ? id.slice(DAY_PREFIX.length) : null
}

/**
 * 解析任务拖拽 id（格式 `${task.id}-${date}`），还原 taskId 与实例日期。
 * 重复任务多实例的 dnd id 已唯一化，不能直接当作 task.id 使用。
 */
export function parseTaskDragId(id: string): { taskId: string; occurrenceDate: string } | null {
  if (id.length <= DATE_LEN + 1) return null
  const occurrenceDate = id.slice(-DATE_LEN)
  const taskId = id.slice(0, id.length - DATE_LEN - 1)
  return { taskId, occurrenceDate }
}

export interface DragDateHandlers {
  dragOverDate: string | null
  onDragOver: (event: DragOverEvent) => void
  onDragEnd: (event: DragEndEvent) => void
}

export function useDragDate(): DragDateHandlers {
  const dragOverDate = useUiStore((s) => s.dragOverDate)
  const setDragOverDate = useUiStore((s) => s.setDragOverDate)
  const tasks = useTaskStore((s) => s.tasks)
  const moveTask = useTaskStore((s) => s.moveTask)
  const setOverride = useTaskStore((s) => s.setOverride)
  const createTask = useTaskStore((s) => s.createTask)

  const onDragOver = (event: DragOverEvent): void => {
    const overId = event.over ? String(event.over.id) : null
    const date = overId ? parseDayDropId(overId) : null
    setDragOverDate(date)
  }

  const onDragEnd = (event: DragEndEvent): void => {
    const overId = event.over ? String(event.over.id) : null
    setDragOverDate(null)
    const targetDate = overId ? parseDayDropId(overId) : null
    if (!targetDate) return

    const parsed = parseTaskDragId(String(event.active.id))
    if (!parsed) return
    const { taskId, occurrenceDate } = parsed
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // 重复任务的非 anchor 实例：跳过原实例 + 目标日期创建单次副本（PRD P0-05 单日独立操作）
    if (task.repeat && occurrenceDate !== task.date) {
      void setOverride(taskId, occurrenceDate, 'skipped')
      void createTask({
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        date: targetDate,
        repeat: null,
      })
      return
    }
    void moveTask(taskId, targetDate)
  }

  return { dragOverDate, onDragOver, onDragEnd }
}
