/**
 * 习惯打卡面板：新增 / 删除 / 每日勾选打卡。
 * 增强：连续打卡徽章、本周 7 天打卡圆点（亮/暗区分）、归档/停用、空状态引导。
 */
import { useState } from 'react'
import { todayStr, weekDates } from '../../../../shared/date'
import { isCheckedOn, streakOf } from '../../../../shared/habit'
import { useConfigStore } from '../../stores/configStore'
import { useHabitStore } from '../../stores/habitStore'

function HabitRow({ id }: { id: string }) {
  const habits = useHabitStore((s) => s.habits)
  const toggle = useHabitStore((s) => s.toggle)
  const setArchived = useHabitStore((s) => s.setArchived)
  const remove = useHabitStore((s) => s.remove)
  const weekStart = useConfigStore((s) => s.weekStart)

  const habit = habits.find((h) => h.id === id)
  if (!habit) return null

  const today = todayStr()
  const week = weekDates(today, weekStart)
  const checked = isCheckedOn(habit, today)
  const streak = streakOf(habit, today)
  const archived = habit.archived === true

  return (
    <li className={`habit-item ${archived ? 'archived' : ''}`}>
      <button
        className={`check ${checked ? 'checked' : ''}`}
        onClick={() => void toggle(id, today)}
        aria-label="今日打卡"
        disabled={archived}
      >
        {checked ? '✓' : ''}
      </button>

      <div className="habit-main">
        <div className="habit-title-row">
          <span className={`habit-title ${checked ? 'done-text' : ''}`}>{habit.title}</span>
          {streak > 0 && (
            <span className="habit-streak-badge" title={`连续打卡 ${streak} 天`}>
              🔥 {streak}
            </span>
          )}
          {archived && <span className="habit-archived-tag">已归档</span>}
        </div>
        {/* 本周 7 天打卡圆点：亮 = 已打卡，暗 = 未打卡 */}
        <div className="habit-week" title={week.join(' / ')}>
          {week.map((d) => {
            const on = isCheckedOn(habit, d)
            return (
              <span
                key={d}
                className={`habit-dot ${on ? 'on' : ''} ${d === today ? 'today' : ''}`}
                title={`${d}${on ? ' 已打卡' : ' 未打卡'}`}
              />
            )
          })}
        </div>
      </div>

      <span className="habit-streak">连续 {streak} 天</span>

      <div className="habit-actions">
        <button className="text-btn" onClick={() => void setArchived(id, !archived)}>
          {archived ? '恢复' : '归档'}
        </button>
        <button className="danger-btn" onClick={() => void remove(id)}>
          删除
        </button>
      </div>
    </li>
  )
}

export function HabitPanel() {
  const habits = useHabitStore((s) => s.habits)
  const create = useHabitStore((s) => s.create)
  const [title, setTitle] = useState('')

  const active = habits.filter((h) => h.archived !== true)
  const archived = habits.filter((h) => h.archived === true)

  const onSubmit = (): void => {
    const t = title.trim()
    if (!t) return
    void create(t)
    setTitle('')
  }

  return (
    <div className="panel">
      <h2>习惯打卡</h2>

      <div className="mb-4 flex gap-2">
        <input
          className="input flex-1"
          placeholder="新习惯名称（如：喝水、早睡）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
          }}
        />
        <button className="primary-btn" onClick={onSubmit} disabled={!title.trim()}>
          新增
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌱</div>
          <div className="empty-state-title">从一个小习惯开始</div>
          <div className="empty-state-desc">
            在上方输入习惯名称并点击「新增」，坚持每天打卡，这里会记录你的连续天数与本周进度。
          </div>
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <div className="panel-empty">所有习惯都已归档，新增一个或从归档中恢复</div>
          ) : (
            <ul className="panel-list">
              {active.map((h) => (
                <HabitRow key={h.id} id={h.id} />
              ))}
            </ul>
          )}

          {archived.length > 0 && (
            <div className="habit-archived-section">
              <div className="habit-archived-head">已归档（保留历史，不再每日打卡）</div>
              <ul className="panel-list">
                {archived.map((h) => (
                  <HabitRow key={h.id} id={h.id} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
