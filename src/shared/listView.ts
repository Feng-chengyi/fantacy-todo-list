/**
 * 待办任务仓库纯函数（无 IO / 无 React，可独立单测）。
 *
 * 口径（buildTaskRepository，v3 待办首页）：
 * - 待办页 = 全量任务仓库：每个任务（含习惯/目标任务）仅一行，不按日期分组、
 *   不展开重复实例、不预生成任何未来日期任务；
 * - 联动状态筛选：all 不过滤，否则仅保留匹配状态的任务；
 * - 排序：pending → done → abandoned；同状态内有日期按日期升序（无日期排最后），
 *   再按开始时间 / 优先级 / 创建时间稳定排序。
 */
import { PRIORITY_ORDER } from './defaults'
import { timeToMinutes } from './time'
import type { Task, TaskStatus, TaskType } from './types'

export type ListViewFilter = 'all' | TaskStatus

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/** YYYY-MM-DD → 「M月d日 周X」标签（非法格式原样返回） */
export function listDateLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  // 进位检查：月份/日期被 Date 滚动（如 2026-13-99）视为非法
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return date
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAY_LABELS[d.getDay()]}`
}

const STATUS_RANK: Record<TaskStatus, number> = { pending: 0, done: 1, abandoned: 2 }

/** 任务类型标签（v3：任务行 / 弹窗统一文案） */
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  normal: '普通',
  habit: '习惯',
  goal: '目标',
}

/**
 * 构建待办任务仓库：每个任务（含习惯/目标任务）仅一行，无日期分组、无重复展开。
 */
export function buildTaskRepository(tasks: Task[], filter: ListViewFilter): Task[] {
  return tasks
    .filter((t) => filter === 'all' || t.status === filter)
    .sort((a, b) => {
      const sr = STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (sr !== 0) return sr
      const ad = a.date ?? '9999-12-31'
      const bd = b.date ?? '9999-12-31'
      if (ad < bd) return -1
      if (ad > bd) return 1
      const at = a.startTime ?? ''
      const bt = b.startTime ?? ''
      if (at !== bt) {
        if (!at) return 1
        if (!bt) return -1
        return timeToMinutes(at) - timeToMinutes(bt)
      }
      const pr = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (pr !== 0) return pr
      return a.createdAt.localeCompare(b.createdAt)
    })
}
