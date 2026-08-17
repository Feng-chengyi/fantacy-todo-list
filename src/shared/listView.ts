/**
 * 列表视图分组纯函数（无 IO / 无 React，可独立单测）。
 *
 * 口径（buildListGroups，时间轴-列表视图）：
 * - 收集箱（date=null）一组，置于列表最前。
 * - 非重复任务按其日期分组（历史与未来全部可见）。
 * - 重复任务自 anchor 起逐日展开，上限 today + horizonDays（无 endDate 的无限重复
 *   不会撑爆列表）；endDate / endCount 边界由 repeatEngine 处理。
 * - 联动侧栏筛选：all 不过滤，否则仅保留匹配状态的实例；skipped 实例始终隐藏。
 * - 日期组按日期升序；组内按「有时间在前 + 开始时间升序，其余按优先级/创建时间」。
 *
 * 口径（buildTodoGroups，待办首页）：
 * - 仅「已逾期（未完成非重复）+ 今日 + 未来」分组，不含收集箱；
 * - 重复任务自今日起展开，历史实例交由时间轴页面复盘。
 */
import { listOccurrencesInRange } from './repeatEngine'
import { PRIORITY_ORDER } from './defaults'
import { timeToMinutes } from './time'
import type { Occurrence, Priority, RepeatOverride, Task, TaskStatus } from './types'

export type ListViewFilter = 'all' | TaskStatus

export interface ListGroup {
  /** 'inbox' 或 YYYY-MM-DD */
  key: string
  /** 展示标签（收集箱 / M月d日 周X） */
  label: string
  /** 是否今日组（高亮） */
  isToday: boolean
  occurrences: Occurrence[]
}

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

function matchesFilter(status: TaskStatus, filter: ListViewFilter): boolean {
  return filter === 'all' || status === filter
}

function rank(priority: Priority): number {
  return PRIORITY_ORDER[priority]
}

/** 组内排序：有时间在前并按开始时间升序，其余按优先级、创建时间 */
function byTimeThenPriority(a: Occurrence, b: Occurrence): number {
  const aTime = a.task.startTime
  const bTime = b.task.startTime
  if (aTime && bTime) {
    const diff = timeToMinutes(aTime) - timeToMinutes(bTime)
    if (diff !== 0) return diff
  }
  if (aTime && !bTime) return -1
  if (!aTime && bTime) return 1
  const diff = rank(a.task.priority) - rank(b.task.priority)
  if (diff !== 0) return diff
  return a.task.createdAt.localeCompare(b.task.createdAt)
}

/** 日期字符串加 N 天（YYYY-MM-DD） */
function addDaysStr(date: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  d.setDate(d.getDate() + days)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 向分组 Map 追加一条实例 */
function pushOccurrence(map: Map<string, Occurrence[]>, key: string, occ: Occurrence): void {
  const list = map.get(key)
  if (list) list.push(occ)
  else map.set(key, [occ])
}

/** 日期键 → 升序分组（组内按时间/优先级排序，今日组高亮） */
function dateGroupsOf(map: Map<string, Occurrence[]>, today: string): ListGroup[] {
  const groups: ListGroup[] = []
  const dateKeys = [...map.keys()].sort()
  for (const key of dateKeys) {
    const occurrences = map.get(key) as Occurrence[]
    occurrences.sort(byTimeThenPriority)
    groups.push({ key, label: listDateLabel(key), isToday: key === today, occurrences })
  }
  return groups
}

/**
 * 构建列表视图分组：收集箱组（可能为空则不产生）+ 日期组升序。
 */
export function buildListGroups(
  tasks: Task[],
  overrides: RepeatOverride[],
  filter: ListViewFilter,
  today: string,
  horizonDays = 90,
): ListGroup[] {
  const map = new Map<string, Occurrence[]>()

  for (const task of tasks) {
    if (task.date == null) {
      // 收集箱：按任务状态过滤
      if (!matchesFilter(task.status, filter)) continue
      pushOccurrence(map, 'inbox', { task, date: '', status: task.status })
      continue
    }

    if (task.repeat) {
      // 重复任务：anchor 起展开到 min(endDate 无则 today+horizon, today+horizon)
      const to = addDaysStr(today, horizonDays)
      const entries = listOccurrencesInRange(task.repeat, task.date, task.date, to, overrides, task.status, task.id)
      for (const entry of entries) {
        if (entry.status === 'skipped') continue
        if (!matchesFilter(entry.status as TaskStatus, filter)) continue
        pushOccurrence(map, entry.date, { task, date: entry.date, status: entry.status as TaskStatus })
      }
    } else {
      if (!matchesFilter(task.status, filter)) continue
      pushOccurrence(map, task.date, { task, date: task.date, status: task.status })
    }
  }

  const groups: ListGroup[] = []
  const inbox = map.get('inbox')
  if (inbox && inbox.length > 0) {
    inbox.sort(byTimeThenPriority)
    groups.push({ key: 'inbox', label: '收集箱', isToday: false, occurrences: inbox })
  }
  map.delete('inbox') // 收集箱已单独成组，剩余键全部为日期组
  return [...groups, ...dateGroupsOf(map, today)]
}

/**
 * 构建待办首页分组（聚焦未来任务规划场景）：
 * - 「已逾期」组置顶：仅收录日期早于今日且未完成的非重复任务；
 * - 今日 + 未来日期组升序：重复任务自今日起展开（历史实例归时间轴复盘）；
 * - 不含收集箱（收集箱为独立页面）。
 */
export function buildTodoGroups(
  tasks: Task[],
  overrides: RepeatOverride[],
  filter: ListViewFilter,
  today: string,
  horizonDays = 90,
): ListGroup[] {
  const map = new Map<string, Occurrence[]>()
  const overdue: Occurrence[] = []

  for (const task of tasks) {
    if (task.date == null) continue

    if (task.repeat) {
      const to = addDaysStr(today, horizonDays)
      const entries = listOccurrencesInRange(task.repeat, task.date, today, to, overrides, task.status, task.id)
      for (const entry of entries) {
        if (entry.status === 'skipped') continue
        if (entry.date < today) continue
        if (!matchesFilter(entry.status as TaskStatus, filter)) continue
        pushOccurrence(map, entry.date, { task, date: entry.date, status: entry.status as TaskStatus })
      }
    } else {
      if (!matchesFilter(task.status, filter)) continue
      if (task.date < today) {
        if (task.status === 'pending') overdue.push({ task, date: task.date, status: task.status })
      } else {
        pushOccurrence(map, task.date, { task, date: task.date, status: task.status })
      }
    }
  }

  const groups: ListGroup[] = []
  if (overdue.length > 0) {
    overdue.sort(byTimeThenPriority)
    groups.push({ key: 'overdue', label: '已逾期', isToday: false, occurrences: overdue })
  }
  return [...groups, ...dateGroupsOf(map, today)]
}
