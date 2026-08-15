/**
 * 月历视图：星期表头 + 网格。
 */
import { useConfigStore } from '../../stores/configStore'
import { CalendarGrid } from './CalendarGrid'

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function MonthCalendar() {
  const weekStart = useConfigStore((s) => s.weekStart)
  // 周一开头：一二三四五六日；周日开头：日一二三四五六
  const labels = weekStart === 0 ? ['日', ...WEEK_LABELS.slice(0, 6)] : WEEK_LABELS

  return (
    <div className="flex h-full flex-col">
      <div
        className="grid shrink-0 grid-cols-7 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {labels.map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="py-1.5 text-center text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            {w}
          </div>
        ))}
      </div>
      <CalendarGrid />
    </div>
  )
}
