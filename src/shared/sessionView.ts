/**
 * 专注记录时间轴纯函数（无 IO / 无 React，可独立单测）。
 * 时间轴页面（月/周/日/列表）唯一数据口径：只展示已落库的 FocusSession，
 * 不包含任何未计时任务的占位记录（计时才生成记录，不计时当日无痕迹）。
 */
import { sessionLocalDate } from './focus'
import type { FocusSession } from './types'

/** 某日专注汇总（今日统计栏 / 日期组标题） */
export interface SessionDaySummary {
  count: number
  totalSec: number
}

/** 按会话开始时刻的本地日期分组；组内按开始时间升序（ISO 字符串字典序） */
export function groupSessionsByDate(sessions: FocusSession[]): Map<string, FocusSession[]> {
  const map = new Map<string, FocusSession[]>()
  for (const s of sessions) {
    const key = sessionLocalDate(s.startedAt)
    const list = map.get(key)
    if (list) list.push(s)
    else map.set(key, [s])
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  }
  return map
}

/** 指定日期（本地 YYYY-MM-DD）的专注汇总：次数与总秒数 */
export function summarizeDay(sessions: FocusSession[], date: string): SessionDaySummary {
  let count = 0
  let totalSec = 0
  for (const s of sessions) {
    if (sessionLocalDate(s.startedAt) === date) {
      count++
      totalSec += s.durationSec
    }
  }
  return { count, totalSec }
}

/** ISO 时刻 → 本地 HH:mm */
function localHm(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 会话时间段标签：「HH:mm–HH:mm」（起止同一分钟也保留区间形式） */
export function sessionRangeLabel(session: FocusSession): string {
  return `${localHm(session.startedAt)}–${localHm(session.endedAt)}`
}
