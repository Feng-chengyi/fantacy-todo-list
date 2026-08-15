/**
 * 重复规则编辑器：类型 / 间隔 / 星期 / 月日 / 年月日 / 结束条件。
 */
import type { RepeatRule, RepeatType } from '../../../../shared/types'

const TYPE_LABELS: { key: RepeatType; label: string }[] = [
  { key: 'daily', label: '每天' },
  { key: 'weekly', label: '每周' },
  { key: 'monthly', label: '每月' },
  { key: 'yearly', label: '每年' },
  { key: 'custom', label: '自定义（每 N 天）' },
]

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function RepeatRuleEditor({
  value,
  onChange,
}: {
  value: RepeatRule | null
  onChange: (rule: RepeatRule | null) => void
}) {
  const enabled = value != null

  const patch = (p: Partial<RepeatRule>): void => {
    if (!value) return
    onChange({ ...value, ...p })
  }

  const setType = (type: RepeatType | ''): void => {
    if (type === '') {
      onChange(null)
      return
    }
    onChange(value ?? { type, interval: 1 })
  }

  const toggleWeekday = (d: number): void => {
    if (!value) return
    const weekdays = value.weekdays ?? []
    const next = weekdays.includes(d) ? weekdays.filter((w) => w !== d) : [...weekdays, d]
    patch({ weekdays: next.sort((a, b) => a - b) })
  }

  return (
    <div className="repeat-editor">
      <select
        className="select w-full"
        value={enabled ? value!.type : ''}
        onChange={(e) => setType(e.target.value as RepeatType | '')}
      >
        <option value="">不重复</option>
        {TYPE_LABELS.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>

      {enabled && (
        <div className="mt-2 flex flex-col gap-2">
          <label className="repeat-row">
            <span>间隔</span>
            <input
              type="number"
              min={1}
              className="input w-20"
              value={value!.interval}
              onChange={(e) => patch({ interval: Math.max(1, Number(e.target.value) || 1) })}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {value!.type === 'weekly' ? '周' : value!.type === 'monthly' ? '月' : value!.type === 'yearly' ? '年' : '天'}
            </span>
          </label>

          {value!.type === 'weekly' && (
            <div className="flex flex-wrap gap-1">
              {WEEKDAY_LABELS.map((label, d) => {
                const active = (value!.weekdays ?? []).includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    className={`weekday-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleWeekday(d)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {value!.type === 'monthly' && (
            <label className="repeat-row">
              <span>每月第几日</span>
              <input
                type="number"
                min={1}
                max={31}
                className="input w-20"
                value={value!.monthDay ?? 1}
                onChange={(e) => patch({ monthDay: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
              />
            </label>
          )}

          {value!.type === 'yearly' && (
            <div className="flex gap-2">
              <label className="repeat-row">
                <span>月</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="input w-16"
                  value={value!.yearMonth ?? 1}
                  onChange={(e) => patch({ yearMonth: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
                />
              </label>
              <label className="repeat-row">
                <span>日</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="input w-16"
                  value={value!.yearDay ?? 1}
                  onChange={(e) => patch({ yearDay: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
                />
              </label>
            </div>
          )}

          <div className="flex gap-3">
            <label className="repeat-row">
              <span>结束日期</span>
              <input
                type="date"
                className="input"
                value={value!.endDate ?? ''}
                onChange={(e) => patch({ endDate: e.target.value || null })}
              />
            </label>
            <label className="repeat-row">
              <span>次数上限</span>
              <input
                type="number"
                min={1}
                className="input w-20"
                value={value!.endCount ?? ''}
                placeholder="不限"
                onChange={(e) =>
                  patch({ endCount: e.target.value ? Math.max(1, Number(e.target.value)) : null })
                }
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
