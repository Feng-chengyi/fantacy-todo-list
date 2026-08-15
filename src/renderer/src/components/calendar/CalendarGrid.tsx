/**
 * 月历网格：计算前置/后置空白 + DndContext 拖拽落点。
 */
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useConfigStore } from '../../stores/configStore'
import { useUiStore } from '../../stores/uiStore'
import { daysInMonth, leadingBlanks } from '../../../../shared/date'
import { useDragDate } from '../../hooks/useDragDate'
import { DayCell } from './DayCell'

export function CalendarGrid() {
  const currentYear = useUiStore((s) => s.currentYear)
  const currentMonth = useUiStore((s) => s.currentMonth)
  const weekStart = useConfigStore((s) => s.weekStart)
  const { dragOverDate, onDragOver, onDragEnd } = useDragDate()

  const days = daysInMonth(currentYear, currentMonth)
  const leading = leadingBlanks(currentYear, currentMonth, weekStart)
  const totalCells = Math.ceil((leading + days.length) / 7) * 7
  const trailing = totalCells - leading - days.length

  // 拖拽需长按/移动阈值，避免误触点击
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  return (
    <DndContext sensors={sensors} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`lead-${i}`} className="cell-empty" style={{ borderColor: 'var(--border)' }} />
        ))}
        {days.map((date) => (
          <DayCell key={date} date={date} isDropTarget={dragOverDate === date} />
        ))}
        {Array.from({ length: trailing }).map((_, i) => (
          <div key={`trail-${i}`} className="cell-empty" style={{ borderColor: 'var(--border)' }} />
        ))}
      </div>
    </DndContext>
  )
}
