/**
 * 备份文件校验（纯函数，主进程与单测共用）。
 * 校验通过才允许覆盖现有数据；失败绝不改动现有数据。
 */
import type { AppConfig, FullData } from './types'
import { DATA_VERSION, isPetCharacterId, mergeConfig } from './defaults'
import { normalizeHabit, type HabitInput } from './habit'

const PRIORITIES = ['high', 'medium', 'low']
const STATUSES = ['pending', 'done', 'abandoned']
const ACTIONS = ['done', 'skipped']
const REPEAT_TYPES = ['daily', 'weekly', 'monthly', 'yearly', 'custom']

export type ValidateResult =
  | { ok: true; data: FullData; config: AppConfig }
  | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isStringOrNull(v: unknown): boolean {
  return v === null || typeof v === 'string'
}

/** 校验单个 task 的字段；通过返回 null，否则返回错误信息 */
function validateTask(t: unknown, index: number): string | null {
  if (!isRecord(t)) return `tasks[${index}] 不是对象`
  if (!isString(t.id)) return `tasks[${index}].id 类型错误`
  if (!isString(t.title)) return `tasks[${index}].title 类型错误`
  if (!PRIORITIES.includes(t.priority as string)) return `tasks[${index}].priority 非法`
  if (!STATUSES.includes(t.status as string)) return `tasks[${index}].status 非法`
  if (t.date !== null && !isString(t.date)) return `tasks[${index}].date 类型错误`
  if (!isString(t.createdAt)) return `tasks[${index}].createdAt 类型错误`
  if (!isString(t.updatedAt)) return `tasks[${index}].updatedAt 类型错误`

  // 可选字段类型（缺省可容忍，存在则必须类型正确）
  if (t.description !== undefined && !isString(t.description)) return `tasks[${index}].description 类型错误`
  if (t.completedAt !== undefined && !isStringOrNull(t.completedAt)) return `tasks[${index}].completedAt 类型错误`
  if (t.inboxOrder !== undefined && t.inboxOrder !== null && typeof t.inboxOrder !== 'number') {
    return `tasks[${index}].inboxOrder 类型错误`
  }
  if (t.tags !== undefined && !Array.isArray(t.tags)) return `tasks[${index}].tags 类型错误`
  // 新增可选字段（分类/颜色）：旧数据可缺省，存在则必须为字符串
  if (t.category !== undefined && !isString(t.category)) return `tasks[${index}].category 类型错误`
  if (t.color !== undefined && !isString(t.color)) return `tasks[${index}].color 类型错误`
  // 新增可选字段（时间/用时）：旧数据可缺省
  if (t.startTime !== undefined && !isString(t.startTime)) return `tasks[${index}].startTime 类型错误`
  if (t.endTime !== undefined && !isString(t.endTime)) return `tasks[${index}].endTime 类型错误`
  if (t.durationSec !== undefined && typeof t.durationSec !== 'number') return `tasks[${index}].durationSec 类型错误`
  // 任务提醒：旧数据可缺省；存在则必须为 { time: string }
  if (t.reminder !== undefined && t.reminder !== null) {
    if (!isRecord(t.reminder)) return `tasks[${index}].reminder 不是对象`
    if (!isString(t.reminder.time)) return `tasks[${index}].reminder.time 类型错误`
  }

  // 重复规则结构
  if (t.repeat !== undefined && t.repeat !== null) {
    if (!isRecord(t.repeat)) return `tasks[${index}].repeat 不是对象`
    if (!REPEAT_TYPES.includes(t.repeat.type as string)) return `tasks[${index}].repeat.type 非法`
    if (typeof t.repeat.interval !== 'number') return `tasks[${index}].repeat.interval 类型错误`
    if (t.repeat.weekdays !== undefined && !Array.isArray(t.repeat.weekdays)) {
      return `tasks[${index}].repeat.weekdays 类型错误`
    }
    if (t.repeat.monthDay !== undefined && typeof t.repeat.monthDay !== 'number') {
      return `tasks[${index}].repeat.monthDay 类型错误`
    }
    if (t.repeat.yearMonth !== undefined && typeof t.repeat.yearMonth !== 'number') {
      return `tasks[${index}].repeat.yearMonth 类型错误`
    }
    if (t.repeat.yearDay !== undefined && typeof t.repeat.yearDay !== 'number') {
      return `tasks[${index}].repeat.yearDay 类型错误`
    }
    if (t.repeat.endDate !== undefined && !isStringOrNull(t.repeat.endDate)) {
      return `tasks[${index}].repeat.endDate 类型错误`
    }
    if (t.repeat.endCount !== undefined && t.repeat.endCount !== null && typeof t.repeat.endCount !== 'number') {
      return `tasks[${index}].repeat.endCount 类型错误`
    }
  }

  return null
}

/** 校验备份 bundle 的 schema；通过则返回可用的 data/config */
export function validateBackupBundle(json: unknown): ValidateResult {
  if (!isRecord(json)) return { ok: false, error: '备份文件不是有效的对象' }
  if (json.app !== 'fantacy-todo-list') return { ok: false, error: '备份文件标识（app）不匹配' }
  if (json.backupVersion !== DATA_VERSION) {
    return { ok: false, error: `backupVersion 不兼容（期望 ${DATA_VERSION}）` }
  }

  if (!isRecord(json.data)) return { ok: false, error: 'data 缺失或类型错误' }
  if (json.data.version !== DATA_VERSION) {
    return { ok: false, error: `data.version 不兼容（期望 ${DATA_VERSION}）` }
  }
  if (!Array.isArray(json.data.tasks)) return { ok: false, error: 'data.tasks 不是数组' }
  if (!Array.isArray(json.data.overrides)) return { ok: false, error: 'data.overrides 不是数组' }

  for (const [i, t] of json.data.tasks.entries()) {
    const err = validateTask(t, i)
    if (err) return { ok: false, error: err }
  }

  for (const [i, o] of json.data.overrides.entries()) {
    if (!isRecord(o)) return { ok: false, error: `overrides[${i}] 不是对象` }
    if (!isString(o.id)) return { ok: false, error: `overrides[${i}].id 类型错误` }
    if (!isString(o.taskId)) return { ok: false, error: `overrides[${i}].taskId 类型错误` }
    if (!isString(o.occurrenceDate)) return { ok: false, error: `overrides[${i}].occurrenceDate 类型错误` }
    if (!ACTIONS.includes(o.action as string)) return { ok: false, error: `overrides[${i}].action 非法` }
  }

  // 新增字段 goals / habits：旧备份可缺省（由 store 回填），存在则必须为数组且元素合法
  if (json.data.goals !== undefined && !Array.isArray(json.data.goals)) {
    return { ok: false, error: 'data.goals 不是数组' }
  }
  if (json.data.habits !== undefined && !Array.isArray(json.data.habits)) {
    return { ok: false, error: 'data.habits 不是数组' }
  }
  const goals: unknown[] = Array.isArray(json.data.goals) ? json.data.goals : []
  const habits: unknown[] = Array.isArray(json.data.habits) ? json.data.habits : []
  for (const [i, g] of goals.entries()) {
    if (!isRecord(g)) return { ok: false, error: `goals[${i}] 不是对象` }
    if (!isString(g.id)) return { ok: false, error: `goals[${i}].id 类型错误` }
    if (!isString(g.title)) return { ok: false, error: `goals[${i}].title 类型错误` }
    if (!isString(g.targetDate)) return { ok: false, error: `goals[${i}].targetDate 类型错误` }
    if (!isString(g.createdAt)) return { ok: false, error: `goals[${i}].createdAt 类型错误` }
    // 新增可选字段：旧备份可缺省，存在则必须类型正确
    if (g.category !== undefined && !isString(g.category)) return { ok: false, error: `goals[${i}].category 类型错误` }
    if (g.color !== undefined && !isString(g.color)) return { ok: false, error: `goals[${i}].color 类型错误` }
  }
  for (const [i, h] of habits.entries()) {
    if (!isRecord(h)) return { ok: false, error: `habits[${i}] 不是对象` }
    if (!isString(h.id)) return { ok: false, error: `habits[${i}].id 类型错误` }
    if (!isString(h.title)) return { ok: false, error: `habits[${i}].title 类型错误` }
    if (!Array.isArray(h.checkins)) return { ok: false, error: `habits[${i}].checkins 不是数组` }
    // 新增可选字段：旧备份可缺省，存在则必须为布尔
    if (h.archived !== undefined && typeof h.archived !== 'boolean') return { ok: false, error: `habits[${i}].archived 类型错误` }
  }

  // 新增字段 sessions（专注会话）：旧备份可缺省，存在则必须数组且逐项合法
  if (json.data.sessions !== undefined && !Array.isArray(json.data.sessions)) {
    return { ok: false, error: 'data.sessions 不是数组' }
  }
  const sessions: unknown[] = Array.isArray(json.data.sessions) ? json.data.sessions : []
  for (const [i, s] of sessions.entries()) {
    if (!isRecord(s)) return { ok: false, error: `sessions[${i}] 不是对象` }
    if (!isString(s.id)) return { ok: false, error: `sessions[${i}].id 类型错误` }
    if (!isString(s.taskId)) return { ok: false, error: `sessions[${i}].taskId 类型错误` }
    if (!isString(s.startedAt)) return { ok: false, error: `sessions[${i}].startedAt 类型错误` }
    if (!isString(s.endedAt)) return { ok: false, error: `sessions[${i}].endedAt 类型错误` }
    if (typeof s.durationSec !== 'number' || s.durationSec < 0) {
      return { ok: false, error: `sessions[${i}].durationSec 类型错误` }
    }
    if (s.occurrenceDate !== undefined && !isStringOrNull(s.occurrenceDate)) {
      return { ok: false, error: `sessions[${i}].occurrenceDate 类型错误` }
    }
  }

  if (!isRecord(json.config)) return { ok: false, error: 'config 缺失或类型错误' }
  const cfg = json.config
  if (typeof cfg.petVisible !== 'boolean') return { ok: false, error: 'config.petVisible 类型错误' }
  if (typeof cfg.petScale !== 'number') return { ok: false, error: 'config.petScale 类型错误' }
  if (typeof cfg.confettiEnabled !== 'boolean') return { ok: false, error: 'config.confettiEnabled 类型错误' }
  if (typeof cfg.weekStart !== 'number') return { ok: false, error: 'config.weekStart 类型错误' }
  if (typeof cfg.theme !== 'string') return { ok: false, error: 'config.theme 类型错误' }
  if (!isRecord(cfg.petPosition)) return { ok: false, error: 'config.petPosition 类型错误' }
  if (typeof cfg.petPosition.x !== 'number' || typeof cfg.petPosition.y !== 'number') {
    return { ok: false, error: 'config.petPosition 类型错误' }
  }
  // selectedCharacter 为当前字段：存在则必须为非空字符串（自定义宠物 id 为任意
  // normalizePetId 字符串，不再要求内置枚举；桌宠端加载时对未知 id 运行时回落 bubcat）。
  // 旧备份的 selectedModel（Live2D 时代命名）兼容迁移，仍要求合法内置枚举
  if (cfg.selectedCharacter !== undefined && (typeof cfg.selectedCharacter !== 'string' || cfg.selectedCharacter === '')) {
    return { ok: false, error: 'config.selectedCharacter 类型错误' }
  }
  if (cfg.selectedModel !== undefined && !isPetCharacterId(cfg.selectedModel)) {
    return { ok: false, error: 'config.selectedModel 非法' }
  }
  // 新增配置字段：旧备份可缺省，存在则必须类型正确
  if (cfg.showNotesInCalendar !== undefined && typeof cfg.showNotesInCalendar !== 'boolean') {
    return { ok: false, error: 'config.showNotesInCalendar 类型错误' }
  }
  if (cfg.noteTruncateLength !== undefined && typeof cfg.noteTruncateLength !== 'number') {
    return { ok: false, error: 'config.noteTruncateLength 类型错误' }
  }
  // 提醒相关配置：旧备份可缺省，存在则必须类型正确
  if (cfg.reminderDefaultTime !== undefined && !isString(cfg.reminderDefaultTime)) {
    return { ok: false, error: 'config.reminderDefaultTime 类型错误' }
  }
  if (cfg.reminderSystemNotification !== undefined && typeof cfg.reminderSystemNotification !== 'boolean') {
    return { ok: false, error: 'config.reminderSystemNotification 类型错误' }
  }

  return {
    ok: true,
    data: {
      ...json.data,
      goals: (Array.isArray(json.data.goals) ? json.data.goals : []).map((g) => ({
        ...(g as Record<string, unknown>),
        category: typeof (g as Record<string, unknown>).category === 'string' ? (g as Record<string, unknown>).category : '',
        color: typeof (g as Record<string, unknown>).color === 'string' ? (g as Record<string, unknown>).color : '',
      })),
      habits: (Array.isArray(json.data.habits) ? json.data.habits : []).map((h) =>
        normalizeHabit(h as HabitInput),
      ),
      sessions: Array.isArray(json.data.sessions) ? json.data.sessions : [],
    } as unknown as FullData,
    config: mergeConfig({
      ...json.config,
      selectedCharacter:
        json.config.selectedCharacter ?? (isPetCharacterId(json.config.selectedModel) ? json.config.selectedModel : undefined),
    }) as unknown as AppConfig,
  }
}
