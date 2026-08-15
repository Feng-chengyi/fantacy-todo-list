/**
 * 周视图：7 列（按 weekStart 排列），复用 useOccurrencesForDate 与 TaskCard。
 * 支持拖拽改期（落点高亮）与点击新建，交互与月视图一致。
 */
import { getDay } from 'date-fns'
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { parseLocal, todayStr, weekDates } from '../../../../shared/date'
import { dayDropId, useDragDate } from '../../hooks/useDragDate'
import { useOccurrencesForDate } from '../../hooks/useOccurrences'
import { useConfigStore } from '../../stores/configStore'
import { useUiStore } from '../../stores/uiStore'
import { TaskCard } from './TaskCard'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

interface WeekColumnProps {
  date: string
  isToday: boolean
  isDropTarget: boolean
  onAdd: () => void
}

function WeekColumn({ date, isToday, isDropTarget, onAdd }: WeekColumnProps) {
  const occurrences = useOccurrencesForDate(date)
  const setSelectedDate = useUiStore((s) => s.setSelectedDate)
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(date) })

  const d = parseLocal(date)
  const dayNumber = Number(date.slice(8, 10))

  return (
    <div
      ref={setNodeRef}
      className={`week-column ${isToday ? 'today' : ''} ${isDropTarget || isOver ? 'drop-target' : ''}`}
      style={{ borderColor: 'var(--border)' }}
      onClick={() => setSelectedDate(date)}
    >
      <div className="week-column-head">
        <span className={`week-day-number ${isToday ? 'today-number' : ''}`}>
          {WEEKDAY_LABELS[getDay(d)]} {dayNumber}
        </span>
        <button
          className="add-btn"
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
        >
          +
        </button>
      </div>
      <div className="week-column-body">
        {occurrences.map((occ) => (
          <TaskCard key={`${occ.task.id}-${occ.date}`} occurrence={occ} />
        ))}
      </div>
    </div>
  )
}

export function WeekView() {
  const selectedDate = useUiStore((s) => s.selectedDate)
  const weekStart = useConfigStore((s) => s.weekStart)
  const openCreate = useUiStore((s) => s.openCreate)
  const { dragOverDate, onDragOver, onDragEnd } = useDragDate()

  const today = todayStr()
  const dates = weekDates(selectedDate ?? today, weekStart)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  return (
    <DndContext sensors={sensors} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="week-view">
        {dates.map((date) => (
          <WeekColumn
            key={date}
            date={date}
            isToday={date === today}
            isDropTarget={dragOverDate === date}
            onAdd={() => openCreate(date)}
          />
        ))}
      </div>
    </DndContext>
  )
}
