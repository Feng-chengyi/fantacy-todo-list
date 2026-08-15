/**
 * 倒数日面板：目标列表 + 新增/删除。
 * 增强：目标可设分类/颜色、按剩余天数排序、更醒目的进度可视化（进度条 + 剩余/已过文案）。
 */
import { useMemo, useState } from 'react'
import { todayStr } from '../../../../shared/date'
import { daysUntil, sortGoalsByDays } from '../../../../shared/countdown'
import { CATEGORY_PRESETS, COLOR_PRESETS } from '../../../../shared/defaults'
import { useGoalStore } from '../../stores/goalStore'

/** 进度百分比：距「今天 → 目标日」在一年窗口内的可视化（钳制到 0–100） */
function progressOf(days: number): number {
  if (days >= 0) {
    // 未来：以 365 天为满进度，剩余越少越接近完成
    return Math.max(0, Math.min(100, Math.round((1 - days / 365) * 100)))
  }
  return 100
}

export function CountdownPanel() {
  const goals = useGoalStore((s) => s.goals)
  const create = useGoalStore((s) => s.create)
  const remove = useGoalStore((s) => s.remove)
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('')

  const today = todayStr()
  const sorted = useMemo(() => sortGoalsByDays(goals, today), [goals, today])

  const onSubmit = (): void => {
    const t = title.trim()
    if (!t || !targetDate) return
    void create(t, targetDate, category.trim(), color.trim())
    setTitle('')
    setTargetDate('')
    setCategory('')
    setColor('')
  }

  return (
    <div className="panel">
      <h2>倒数日</h2>

      <div className="goal-form">
        <input
          className="input"
          style={{ flex: 2 }}
          placeholder="目标名称（如：考试、生日）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="date"
          className="input"
          style={{ flex: 1 }}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      <div className="goal-form">
        <div className="goal-form-field">
          <div className="goal-form-label">分类</div>
          <div className="goal-category-row">
            {CATEGORY_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`category-chip ${category === c ? 'active' : ''}`}
                onClick={() => setCategory(category === c ? '' : c)}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            className="input w-full"
            placeholder="自定义分类（可选）"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
      </div>

      <div className="goal-form">
        <div className="goal-form-field">
          <div className="goal-form-label">颜色</div>
          <div className="goal-color-row">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${color === c ? 'active' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => setColor(color === c ? '' : c)}
              />
            ))}
            <label
              className="color-swatch color-swatch-custom"
              title="自定义颜色"
              style={{
                background:
                  color || 'conic-gradient(#e5484d,#f5a623,#22c55e,#3b82f6,#8b5cf6,#e5484d)',
              }}
            >
              <input
                type="color"
                className="color-input"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6c5ce7'}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <button className="primary-btn" onClick={onSubmit} disabled={!title.trim() || !targetDate}>
          新增
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">设定你的第一个目标</div>
          <div className="empty-state-desc">
            输入目标名称与日期，可附分类与颜色；倒数日会按剩余天数排序并展示进度。
          </div>
        </div>
      ) : (
        <ul className="panel-list">
          {sorted.map((g) => {
            const days = daysUntil(g.targetDate, today)
            const upcoming = days >= 0
            const pct = progressOf(days)
            const barColor = g.color?.trim() || 'var(--accent)'
            return (
              <li key={g.id} className="goal-item">
                <span
                  className="goal-color-dot"
                  style={{ background: g.color?.trim() || 'var(--accent)' }}
                />
                <div className="goal-main">
                  <div className="goal-title-row">
                    <span className="goal-title">{g.title}</span>
                    {g.category && <span className="goal-category">{g.category}</span>}
                  </div>
                  <div className="goal-progress-row">
                    <div className="goal-progress-track" style={{ background: 'var(--bg)' }}>
                      <div
                        className="goal-progress-fill"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                    <span className={`goal-days ${upcoming ? '' : 'overdue'}`}>
                      {upcoming
                        ? days === 0
                          ? '就是今天'
                          : `还剩 ${days} 天`
                        : `已过 ${-days} 天`}
                    </span>
                  </div>
                </div>
                <span className="goal-date">{g.targetDate}</span>
                <button className="danger-btn" onClick={() => void remove(g.id)}>
                  删除
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
