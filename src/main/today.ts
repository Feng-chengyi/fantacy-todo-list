/**
 * 今日待办计算 + 气泡推送（主进程）。
 * 复用 shared 的 repeatEngine/date 纯函数展开重复任务当日实例。
 */
import { todayStr } from '../shared/date'
import { getOccurrenceStatus, isOccurrenceOnDate } from '../shared/repeatEngine'
import { PRIORITY_ORDER } from '../shared/defaults'
import { daysUntil, sortGoalsByDays } from '../shared/countdown'
import { IPC_MAIN } from '../shared/ipc-channels'
import type { PetGoal, TodayTodo } from '../shared/types'
import { store } from './store'
import { getPetWindow } from './windows'

/** 计算今日待办（含重复任务当日实例展开 + done/skipped 覆盖过滤） */
export function computeTodayTodos(): TodayTodo[] {
  const data = store.getData()
  const today = todayStr()
  const result: TodayTodo[] = []

  for (const task of data.tasks) {
    // 收集箱项（date=null）不计入
    if (task.date == null) continue
    if (task.status !== 'pending') continue

    let hit = false
    if (task.repeat) {
      if (isOccurrenceOnDate(today, task.repeat, task.date)) {
        const status = getOccurrenceStatus(task.id, today, data.overrides, task.status)
        hit = status === 'pending' // done/skipped 均不计入
      }
    } else {
      hit = task.date === today
    }

    if (hit) result.push({ taskId: task.id, title: task.title, priority: task.priority })
  }

  result.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  return result
}

/** 组装文本并向桌宠窗口推送气泡；窗口不存在或今日无待办时静默跳过 */
export function pushTodayBubble(): void {
  const win = getPetWindow()
  if (!win) return

  const todos = computeTodayTodos()
  // 今日无待办时不推气泡，避免每次数据变更都打扰
  if (todos.length === 0) return

  let text = `今日 ${todos.length} 个待办`
  const lines = todos
    .slice(0, 3)
    .map((t) => `• ${t.title}`)
    .join('\n')
  text += `\n${lines}${todos.length > 3 ? '\n…' : ''}`

  win.webContents.send(IPC_MAIN.petBubble, text)
}

/**
 * 向桌宠窗口推送结构化「今日待办」列表（悬浮浮层数据源）。
 * 复用 computeTodayTodos 结果（含重复任务当日实例展开 + done/skipped 覆盖过滤）。
 * 今日无待办时推送空数组，供浮层据此隐藏「今日待办」标题。
 */
export function pushTodayTodos(): void {
  const win = getPetWindow()
  if (!win) return
  win.webContents.send(IPC_MAIN.petTodayTodos, computeTodayTodos())
}

/** 计算桌宠浮层展示的倒数日目标（剩余天数 + 按剩余天数排序） */
export function computePetGoals(): PetGoal[] {
  const data = store.getData()
  const today = todayStr()
  const goals: PetGoal[] = data.goals.map((g) => ({
    id: g.id,
    title: g.title,
    targetDate: g.targetDate,
    daysLeft: daysUntil(g.targetDate, today),
    category: g.category ?? '',
    color: g.color ?? '',
  }))
  return sortGoalsByDays(goals, today)
}

/** 向桌宠窗口推送倒数日目标（悬浮浮层数据源） */
export function pushGoals(): void {
  const win = getPetWindow()
  if (!win) return
  win.webContents.send(IPC_MAIN.petGoals, computePetGoals())
}
