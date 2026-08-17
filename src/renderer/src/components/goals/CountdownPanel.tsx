/**
 * v3.1 倒数日面板：目标列表 + 新增/删除。
 * - 里程碑（N5）：最后 30 天 / 最后 7 天 / 就是今天 分级高亮；到期当日撒花 + 桌宠庆祝（每次会话一次）；
 * - 过期归档（N5）：已过期目标半透明灰度沉底分组；
 * - 删除二次确认（F3）：统一 ConfirmDialog，替代裸删除。
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { todayStr } from '../../../../shared/date'
import { daysUntil } from '../../../../shared/countdown'
import { CATEGORY_PRESETS, COLOR_PRESETS } from '../../../../shared/defaults'
import { useConfigStore } from '../../stores/configStore'
import { useGoalStore } from '../../stores/goalStore'
import { fireConfetti } from '../../lib/confetti'
import { showBubble } from '../../services/ipc'
import { ConfirmDialog } from '../stats/ConfirmDialog'
import { EmptyState } from '../common/EmptyState'

/** 进度百分比：距「今天 → 目标日」在一年窗口内的可视化（钳制到 0–100） */
function progressOf(days: number): number {
  if (days >= 0) {
    // 未来：以 365 天为满进度，剩余越少越接近完成
    return Math.max(0, Math.min(100, Math.round((1 - days / 365) * 100)))
  }
  return 100
}

/** 里程碑分级（N5）：null = 常规；'today' 到期日；'final' 最后 7 天；'sprint' 最后 30 天 */
function milestoneOf(days: number): 'today' | 'final' | 'sprint' | null {
  if (days === 0) return 'today'
  if (days >= 1 && days <= 7) return 'final'
  if (days <= 30) return 'sprint'
  return null
}

/** 到期庆祝会话去重：同一目标同一天只庆祝一次 */
const celebrated = new Set<string>()

export function CountdownPanel() {
  const goals = useGoalStore((s) => s.goals)
  const create = useGoalStore((s) => s.create)
  const remove = useGoalStore((s) => s.remove)
  const confettiEnabled = useConfigStore((s) => s.confettiEnabled)
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('')
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)

  const today = todayStr()
  const sorted = useMemo(() => sortWithOverdueSink(goals, today), [goals, today])
  const todayGoals = useMemo(() => goals.filter((g) => daysUntil(g.targetDate, today) === 0), [goals, today])
  // 过期分组标题挂在第一条过期目标上（sorted = [...未来, ...过期]）
  const firstOverdueId = useMemo(() => {
    const first = sorted.find((g) => daysUntil(g.targetDate, today) < 0)
    return first?.id ?? null
  }, [sorted, today])

  // 到期庆祝（P1-3 轻量版）：今日到期目标挂载时撒花 + 桌宠气泡（会话内每目标一次）
  useEffect(() => {
    for (const g of todayGoals) {
      const key = `${today}:${g.id}`
      if (celebrated.has(key)) continue
      celebrated.add(key)
      if (confettiEnabled) fireConfetti()
      void showBubble(`🎉「${g.title}」就是今天！`)
      break // 一次挂载最多庆祝一次，避免连发
    }
  }, [todayGoals, today, confettiEnabled])

  const onSubmit = (): void => {
    const t = title.trim()
    if (!t || !targetDate) return
    void create(t, targetDate, category.trim(), color.trim())
    setTitle('')
    setTargetDate('')
    setCategory('')
    setColor('')
  }

  const confirmRemove = (): void => {
    if (!pendingDelete) return
    void remove(pendingDelete.id)
    setPendingDelete(null)
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
        <EmptyState
          icon="🎯"
          title="设定你的第一个目标"
          desc="输入目标名称与日期，可附分类与颜色；倒数日会按剩余天数排序并展示进度。"
          petState="empty"
        />
      ) : (
        <ul className="panel-list">
          {sorted.map((g) => {
            const days = daysUntil(g.targetDate, today)
            const upcoming = days >= 0
            const pct = progressOf(days)
            const barColor = g.color?.trim() || 'var(--accent)'
            const milestone = milestoneOf(days)
            return (
              <Fragment key={g.id}>
                {!upcoming && g.id === firstOverdueId && (
                  <li className="goal-archived-head" style={{ listStyle: 'none' }}>
                    —— 已过期（归档展示） ——
                  </li>
                )}
                <li className={`goal-item ${!upcoming ? 'overdue-item' : ''}`}>
                  <span
                    className="goal-color-dot"
                    style={{ background: g.color?.trim() || 'var(--accent)' }}
                  />
                  <div className="goal-main">
                    <div className="goal-title-row">
                      <span className="goal-title">{g.title}</span>
                      {g.category && <span className="goal-category">{g.category}</span>}
                      {milestone === 'today' && <span className="goal-milestone today-goal">🎉 就是今天</span>}
                      {milestone === 'final' && <span className="goal-milestone soon">最后 7 天</span>}
                      {milestone === 'sprint' && <span className="goal-milestone">30 天冲刺</span>}
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
                  <button className="danger-btn" onClick={() => setPendingDelete({ id: g.id, title: g.title })}>
                    删除
                  </button>
                </li>
              </Fragment>
            )
          })}
        </ul>
      )}

      {/* 删除二次确认（F3） */}
      {pendingDelete && (
        <ConfirmDialog
          title={`删除倒数日「${pendingDelete.title}」`}
          detail="删除后该目标的倒数进度与记录将一并移除。"
          confirmLabel="确认删除"
          onConfirm={confirmRemove}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

/** 未来目标按剩余天数升序；过期目标按过期天数降序沉底（N5 归档分组） */
function sortWithOverdueSink(goals: { id: string; title: string; targetDate: string; category?: string; color?: string; createdAt: string }[], today: string) {
  const upcoming = goals.filter((g) => daysUntil(g.targetDate, today) >= 0)
  const overdue = goals.filter((g) => daysUntil(g.targetDate, today) < 0)
  upcoming.sort((a, b) => daysUntil(a.targetDate, today) - daysUntil(b.targetDate, today))
  overdue.sort((a, b) => daysUntil(a.targetDate, today) - daysUntil(b.targetDate, today)) // -1 > -5：刚过期的排前面
  return [...upcoming, ...overdue]
}
