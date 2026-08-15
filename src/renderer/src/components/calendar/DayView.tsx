/**
 * 日视图：单日任务按时间 / 优先级排列，复用 TaskCard + useOccurrences。
 * 支持拖拽改期与点击新建；冲突任务黄色 ⚠ 标识。
 */
import { getDay } from 'date-fns'
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { parseLocal, todayStr } from '../../../../shared/date'
import { dayDropId, useDragDate } from '../../hooks/useDragDate'
import { useConflictsForDate } from '../../hooks/useConflicts'
import { useOccurrencesForDate } from '../../hooks/useOccurrences'
import { useUiStore } from '../../stores/uiStore'
import { TaskCard } from './TaskCard'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function DayView() {
  const selectedDate = useUiStore((s) => s.selectedDate)
  const openCreate = useUiStore((s) => s.openCreate)
  const { dragOverDate, onDragOver, onDragEnd } = useDragDate()

  const date = selectedDate ?? todayStr()
  const occurrences = useOccurrencesForDate(date, 'time')
  const conflictIds = useConflictsForDate(date)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(date) })

  const d = parseLocal(date)
  const isToday = date === todayStr()

  return (
    <DndContext sensors={sensors} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div
        ref={setNodeRef}
        className={`day-view ${isToday ? 'today' : ''} ${dragOverDate === date || isOver ? 'drop-target' : ''}`}
      >
        <div className="day-view-head">
          <span className="day-view-title">
            {date} 星期{WEEKDAY_LABELS[getDay(d)]}
          </span>
          <button className="add-btn" onClick={() => openCreate(date)}>
            +
          </button>
        </div>
        <div className="day-view-body">
          {occurrences.length === 0 ? (
            <div className="day-view-empty">这一天没有待办，点击右上角「+」新建</div>
          ) : (
            occurrences.map((occ) => (
              <TaskCard
                key={`${occ.task.id}-${occ.date}`}
                occurrence={occ}
                conflict={conflictIds.has(occ.task.id)}
                variant="roomy"
              />
            ))
          )}
        </div>
      </div>
    </DndContext>
  )
}
