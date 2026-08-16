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
    const { taskId } = parsed
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // 统一改期语义：拖拽任意实例（含重复任务）= 该任务整体移动到目标日期。
    // 重复任务即整个系列改期（anchor 平移，由 taskMove 清空旧单日 overrides），
    // 不再「跳过原实例 + 新建单次副本」，避免任务越拖越多。
    void moveTask(taskId, targetDate)
  }

  return { dragOverDate, onDragOver, onDragEnd }
}
