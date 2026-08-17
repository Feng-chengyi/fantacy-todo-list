/**
 * 月历网格（时间轴月视图）：前置/后置空白 + 单日格。
 */
import { useConfigStore } from '../../stores/configStore'
import { useUiStore } from '../../stores/uiStore'
import { daysInMonth, leadingBlanks } from '../../../../shared/date'
import { DayCell } from './DayCell'

export function CalendarGrid() {
  const currentYear = useUiStore((s) => s.currentYear)
  const currentMonth = useUiStore((s) => s.currentMonth)
  const weekStart = useConfigStore((s) => s.weekStart)

  const days = daysInMonth(currentYear, currentMonth)
  const leading = leadingBlanks(currentYear, currentMonth, weekStart)
  const totalCells = Math.ceil((leading + days.length) / 7) * 7
  const trailing = totalCells - leading - days.length

  return (
    <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
      {Array.from({ length: leading }).map((_, i) => (
        <div key={`lead-${i}`} className="cell-empty" style={{ borderColor: 'var(--border)' }} />
      ))}
      {days.map((date) => (
        <DayCell key={date} date={date} />
      ))}
      {Array.from({ length: trailing }).map((_, i) => (
        <div key={`trail-${i}`} className="cell-empty" style={{ borderColor: 'var(--border)' }} />
      ))}
    </div>
  )
}
