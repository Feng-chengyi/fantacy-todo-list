/**
 * 习惯打卡纯函数（无 IO，可独立单测）。
 */
import { formatLocal, parseLocal } from './date'
import type { Habit } from './types'

/** 可能缺省 archived 的习惯输入（旧数据 / 新建返回值统一走此口径补全） */
export type HabitInput = Omit<Habit, 'archived'> & Partial<Pick<Habit, 'archived'>>

/**
 * 补全习惯字段口径：archived 恒为布尔、checkins 恒为数组。
 * store.normalizeData 与 main habitCreate 共用，保证创建返回值与磁盘数据一致（QA Bug 5）。
 */
export function normalizeHabit(habit: HabitInput): Habit {
  return {
    ...habit,
    archived: habit.archived === true,
    checkins: Array.isArray(habit.checkins) ? habit.checkins : [],
  }
}

/** 某习惯是否在某日期打卡 */
export function isCheckedOn(habit: Habit, date: string): boolean {
  return habit.checkins.includes(date)
}

/**
 * 连续打卡天数。
 * 语义：以 today 为终点向前统计；若今天尚未打卡，则从昨天开始统计
 * （当天未打卡不立即断签，习惯断签以「昨天也没打」为准）。
 */
export function streakOf(habit: Habit, today: string): number {
  let streak = 0
  const cursor = parseLocal(today)
  if (!isCheckedOn(habit, formatLocal(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  const MAX_DAYS = 366 * 10
  for (let i = 0; i < MAX_DAYS; i++) {
    if (!isCheckedOn(habit, formatLocal(cursor))) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
