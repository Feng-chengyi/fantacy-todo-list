/**
 * 默认值与枚举映射 —— 数据文件首次初始化时写入的默认内容。
 */
import type { AppConfig, FullData, PetModelId, PetModelInfo, Priority } from './types'

/** 数据格式版本号（data.json / 备份文件共用），导入时校验兼容性 */
export const DATA_VERSION = 1

export const DEFAULT_CONFIG: AppConfig = {
  petVisible: true,
  petPosition: { x: 1000, y: 700 },
  petScale: 1,
  selectedModel: 'haru',
  confettiEnabled: true,
  weekStart: 1,
  theme: 'system',
  pomodoroFocusMinutes: 25,
  pomodoroBreakMinutes: 5,
}

/**
 * 桌宠可选角色模型清单（与 src/pet/public/live2d/models/ 目录一一对应）。
 * path 为相对 pet.html（out/renderer/）的 model3.json 路径，加载时前缀 "./"。
 */
export const PET_MODELS: PetModelInfo[] = [
  { id: 'haru', name: 'Haru 春', path: 'live2d/models/haru/Haru.model3.json' },
  { id: 'hiyori', name: 'Hiyori 日和', path: 'live2d/models/hiyori/Hiyori.model3.json' },
  { id: 'natori', name: 'Natori 名取', path: 'live2d/models/natori/Natori.model3.json' },
]

/** 依据 ID 查模型清单项；未知 ID 回退到第一个（haru） */
export function getPetModel(id: PetModelId | string | undefined): PetModelInfo {
  return PET_MODELS.find((m) => m.id === id) ?? PET_MODELS[0]
}

/** 判断一个值是否为合法的角色 ID（用于旧配置文件缺失字段的兜底） */
export function isPetModelId(value: unknown): value is PetModelId {
  return PET_MODELS.some((m) => m.id === value)
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
