/**
 * 备份文件校验（纯函数，主进程与单测共用）。
 * 校验通过才允许覆盖现有数据；失败绝不改动现有数据。
 */
import type { AppConfig, FullData } from './types'
import { DATA_VERSION, isPetModelId } from './defaults'

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
  if (cfg.pomodoroFocusMinutes !== undefined && typeof cfg.pomodoroFocusMinutes !== 'number') {
    return { ok: false, error: 'config.pomodoroFocusMinutes 类型错误' }
  }
  if (cfg.pomodoroBreakMinutes !== undefined && typeof cfg.pomodoroBreakMinutes !== 'number') {
    return { ok: false, error: 'config.pomodoroBreakMinutes 类型错误' }
  }
  // selectedModel 为新增字段，旧备份可缺省（由 store 回填）；存在则必须合法
  if (cfg.selectedModel !== undefined && !isPetModelId(cfg.selectedModel)) {
    return { ok: false, error: 'config.selectedModel 非法' }
  }

  return {
    ok: true,
    data: json.data as unknown as FullData,
    config: json.config as unknown as AppConfig,
  }
}
