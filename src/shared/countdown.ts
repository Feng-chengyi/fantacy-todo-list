/**
 * 倒数日纯函数（无 IO，可独立单测）。
 */
import { differenceInCalendarDays } from 'date-fns'
import { parseLocal } from './date'

/**
 * 距目标日期的剩余天数（target - today）。
 * 正数 = 未来（还没到），0 = 当天，负数 = 已过。
 */
export function daysUntil(targetDate: string, today: string): number {
  return differenceInCalendarDays(parseLocal(targetDate), parseLocal(today))
}

/**
 * 按剩余天数排序（纯函数，不修改入参）。
 * 语义：未来/当天目标在前（剩余天数升序，越近越靠前），已过目标在后（越近越靠前）。
 */
export function sortGoalsByDays<T extends { targetDate: string }>(goals: T[], today: string): T[] {
  return [...goals].sort((a, b) => {
    const da = daysUntil(a.targetDate, today)
    const db = daysUntil(b.targetDate, today)
    const aUpcoming = da >= 0
    const bUpcoming = db >= 0
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
    if (aUpcoming) return da - db
    // 已过：均为负数，绝对值越小（越近）越靠前 → db - da
    return db - da
  })
}
