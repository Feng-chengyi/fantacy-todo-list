/**
 * 默认值与枚举映射 —— 数据文件首次初始化时写入的默认内容。
 */
import type { AppConfig, FullData, Priority } from './types'

/** 数据格式版本号（data.json / 备份文件共用），导入时校验兼容性 */
export const DATA_VERSION = 1

export const DEFAULT_CONFIG: AppConfig = {
  petVisible: true,
  petPosition: { x: 1000, y: 700 },
  petScale: 1,
  confettiEnabled: true,
  weekStart: 1,
  theme: 'system',
  pomodoroFocusMinutes: 25,
  pomodoroBreakMinutes: 5,
}

export const DEFAULT_DATA: FullData = {
  version: DATA_VERSION,
  tasks: [],
  overrides: [],
}

/** 优先级排序权重（越小越靠前） */
export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/** 优先级中文标签 */
export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export const ALL_PRIORITIES: Priority[] = ['high', 'medium', 'low']
