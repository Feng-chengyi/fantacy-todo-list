/**
 * 悬浮桌宠的「今日待办」浮层卡片：标题 + 优先级色点 + 打勾完成按钮；
 * 下方附带「最近的倒数日目标」（距目标剩余/已过天数 + 分类色点）。
 *
 * 鼠标穿透自管理：进入捕获（setIgnoreMouse(false)），离开恢复穿透（setIgnoreMouse(true)）。
 * 通过 onEnter / onLeave 回调与 PetApp 协调 hover 状态（避免移动到浮层时被立即卸载）。
 * 打勾按钮独立处理（stopPropagation），不干扰桌宠拖拽 / 滚轮。
 */
import { useState } from 'react'
import type { CSSProperties, MouseEvent, Ref } from 'react'
import type { PetGoal, TodayTodo } from '../../shared/types'

const MAX_ITEMS = 6
const MAX_GOALS = 2

interface Props {
  todos: TodayTodo[]
  goals: PetGoal[]
  /** 浮层定位（由 PetApp 依据模型热区计算 + 屏幕感知偏移） */
  style?: CSSProperties
  /** 浮层根节点引用（PetApp 测量尺寸用） */
  rootRef?: Ref<HTMLDivElement>
  onEnter: () => void
  onLeave: () => void
  /** 完成一项后通知桌宠播放庆祝动作 */
  onComplete: (taskId: string) => void
}

/** 剩余天数文案：当天 / 未来 / 已过 */
function goalLabel(goal: PetGoal): string {
  const d = goal.daysLeft
  if (d === 0) return `『${goal.title}』就是今天`
  if (d > 0) return `距『${goal.title}』还有 ${d} 天`
  return `『${goal.title}』已过 ${-d} 天`
}

export function TodayOverlay({ todos, goals, style, rootRef, onEnter, onLeave, onComplete }: Props) {
  const visible = todos.slice(0, MAX_ITEMS)
  const extra = todos.length - visible.length
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())

  // 只展示「最近」的未来/当天目标；主进程已按剩余天数排序，取前 MAX_GOALS 个非已过目标
  const upcomingGoals = goals.filter((g) => g.daysLeft >= 0).slice(0, MAX_GOALS)

  const complete = (taskId: string, e: MouseEvent): void => {
    e.stopPropagation()
    setDoneIds((prev) => {
      const next = new Set(prev)
      next.add(taskId)
      return next
    })
    void window.petApi.completeTask(taskId)
    onComplete(taskId)
  }

  return (
    <div
      ref={rootRef}
      className="today-overlay"
      style={style}
      onMouseEnter={() => {
        void window.petApi.setIgnoreMouse(false)
        onEnter()
      }}
      onMouseLeave={() => {
        void window.petApi.setIgnoreMouse(true)
        onLeave()
      }}
    >
      <div className="today-overlay-head">今日待办 · {todos.length}</div>
      {visible.length === 0 ? (
        <div className="today-overlay-empty">今天没有待办啦 🎉</div>
      ) : (
        <ul className="today-overlay-list">
          {visible.map((t) => {
            const done = doneIds.has(t.taskId)
            return (
              <li key={t.taskId} className={`today-overlay-item ${done ? 'done' : ''}`}>
                <span className={`todo-dot ${t.priority}`} />
                <span className="today-overlay-title">{t.title}</span>
                <button
                  className={`today-overlay-check ${done ? 'checked' : ''}`}
                  onClick={(e) => complete(t.taskId, e)}
                  aria-label="完成"
                >
                  {done ? '✓' : ''}
                </button>
              </li>
            )
          })}
          {extra > 0 && <li className="today-overlay-more">还有 {extra} 项…</li>}
        </ul>
      )}

      {upcomingGoals.length > 0 && (
        <div className="today-overlay-goals">
          <div className="today-overlay-goals-head">倒数日</div>
          {upcomingGoals.map((g) => (
            <div key={g.id} className="today-overlay-goal">
              <span
                className="todo-dot"
                style={g.color ? { background: g.color } : undefined}
              />
              <span className="today-overlay-goal-text">{goalLabel(g)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
