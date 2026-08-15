/**
 * 单日格：今日高亮、任务数、优先级色条、任务卡列表、可落点、点击新建。
 */
import { useDroppable } from '@dnd-kit/core'
import { todayStr } from '../../../../shared/date'
import { useOccurrencesForDate } from '../../hooks/useOccurrences'
import { useUiStore } from '../../stores/uiStore'
import { dayDropId } from '../../hooks/useDragDate'
import { TaskCard } from './TaskCard'

const MAX_VISIBLE = 3

export function DayCell({ date, isDropTarget }: { date: string; isDropTarget: boolean }) {
  const occurrences = useOccurrencesForDate(date)
  const openCreate = useUiStore((s) => s.openCreate)
  const selectedDate = useUiStore((s) => s.selectedDate)
  const setSelectedDate = useUiStore((s) => s.setSelectedDate)

  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(date) })
  const today = todayStr()
  const isToday = date === today
  const isSelected = date === selectedDate
  const dayNumber = Number(date.slice(8, 10))

  const visible = occurrences.slice(0, MAX_VISIBLE)
  const extra = occurrences.length - MAX_VISIBLE

  return (
    <div
      ref={setNodeRef}
      className={`day-cell ${isDropTarget || isOver ? 'drop-target' : ''} ${isToday ? 'today' : ''} ${
        isSelected ? 'selected' : ''
      }`}
      style={{ borderColor: 'var(--border)' }}
      onClick={() => {
        setSelectedDate(date)
      }}
      onDoubleClick={() => openCreate(date)}
    >
      <div className="flex items-center justify-between px-1.5 pt-1">
        <span className={`day-number ${isToday ? 'today-number' : ''}`}>{dayNumber}</span>
        <button
          className="add-btn"
          title="新建任务"
          onClick={(e) => {
            e.stopPropagation()
            openCreate(date)
          }}
        >
          +
        </button>
      </div>

      <div className="mt-1 flex flex-col gap-1 overflow-hidden px-1">
        {visible.map((occ) => (
          <TaskCard key={`${occ.task.id}-${occ.date}`} occurrence={occ} />
        ))}
        {extra > 0 && (
          <div className="px-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            +{extra} 项
          </div>
        )}
      </div>
    </div>
  )
}
