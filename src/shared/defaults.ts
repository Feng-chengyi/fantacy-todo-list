/**
 * 默认值与枚举映射 —— 数据文件首次初始化时写入的默认内容。
 */
import type { AppConfig, FullData, PetCharacterId, PetCharacterInfo, Priority, ShortcutAction, Task } from './types'

/** 数据格式版本号（data.json / 备份文件共用），导入时校验兼容性 */
export const DATA_VERSION = 2

export const DEFAULT_CONFIG: AppConfig = {
  petVisible: true,
  petPosition: { x: 1000, y: 700 },
  petScale: 1,
  selectedCharacter: 'bubcat',
  confettiEnabled: true,
  weekStart: 1,
  theme: 'system',
  showNotesInCalendar: true,
  noteTruncateLength: 30,
  reminderDefaultTime: '09:00',
  reminderSystemNotification: true,
  appearance: 'system',
  themeColor: '#6c5ce7',
  themeColorDark: '#8b7cf7',
  bgMode: 'plain',
  bgColor: '#f7f8fa',
  bgImage: null,
  bgBlur: 0,
  uiOpacity: 1,
  activeTimer: null,
}

/** v3 主题色预设（设置面板色板 + 深色变体映射；dim = 低饱和次级变体，P1-6） */
export const THEME_COLOR_PRESETS: { name: string; light: string; dark: string; dim: string }[] = [
  { name: '品牌紫', light: '#6c5ce7', dark: '#8b7cf7', dim: '#9d94e8' },
  { name: '海洋蓝', light: '#3b82f6', dark: '#60a5fa', dim: '#93c2fc' },
  { name: '青竹绿', light: '#22c55e', dark: '#4ade80', dim: '#9ae6b4' },
  { name: '珊瑚红', light: '#e5484d', dark: '#f87171', dim: '#f5a3a5' },
  { name: '琥珀橙', light: '#f5a623', dark: '#fbbf24', dim: '#fbd38d' },
  { name: '樱花粉', light: '#ec4899', dark: '#f472b6', dim: '#f9a8d4' },
  { name: '青碧青', light: '#14b8a6', dark: '#2dd4bf', dim: '#99e6df' },
  { name: '石墨灰', light: '#64748b', dark: '#94a3b8', dim: '#b7c1cf' },
]

/**
 * 解析当前配置的亮/暗双色 accent（v3.1 修复 N3.2/F1/F2）：
 * - 显式 themeColorDark 优先（预设点击 / 自定义色写入）；
 * - 否则按 themeColor 反查预设表取 dark 变体（兼容旧配置，默认紫 → 暗紫）；
 * - 均缺省回落 CSS 变量预设（返回 null 时不做内联覆盖，交由 :root 主题预设生效）。
 */
export function accentPair(
  cfg: Pick<AppConfig, 'themeColor' | 'themeColorDark'>,
): { light: string | null; dark: string | null } {
  const light = cfg.themeColor?.trim() || null
  const explicitDark = cfg.themeColorDark?.trim() || null
  if (light) {
    const preset = THEME_COLOR_PRESETS.find((p) => p.light.toLowerCase() === light.toLowerCase())
    return { light, dark: explicitDark ?? preset?.dark ?? light }
  }
  // 无亮色值但有暗色值：亮色回落默认品牌紫
  return { light: explicitDark ? DEFAULT_CONFIG.themeColor ?? '#6c5ce7' : null, dark: explicitDark }
}

/** 按 accent 色值查预设 dim 次级变体（P1-6）；未命中回落 accent 本身 */
export function accentDimOf(accent: string | null): string | null {
  if (!accent) return null
  const preset = THEME_COLOR_PRESETS.find(
    (p) =>
      p.light.toLowerCase() === accent.toLowerCase() ||
      p.dark.toLowerCase() === accent.toLowerCase() ||
      p.dim.toLowerCase() === accent.toLowerCase(),
  )
  return preset?.dim ?? accent
}

/** v3.1 主题预设包（N3.1）：一键切换外观组合（明暗 + 双色 accent + 背景色） */
export interface ThemePreset {
  id: string
  name: string
  emoji: string
  appearance: 'light' | 'dark' | 'system'
  themeColor: string
  themeColorDark: string
  bgColor: string
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'aurora',
    name: '极光紫',
    emoji: '🌌',
    appearance: 'system',
    themeColor: '#6c5ce7',
    themeColorDark: '#8b7cf7',
    bgColor: '#f7f8fa',
  },
  {
    id: 'midnight',
    name: '午夜深蓝',
    emoji: '🌙',
    appearance: 'dark',
    themeColor: '#3b82f6',
    themeColorDark: '#60a5fa',
    bgColor: '#17181c',
  },
  {
    id: 'matcha',
    name: '抹茶清新',
    emoji: '🍵',
    appearance: 'light',
    themeColor: '#22c55e',
    themeColorDark: '#4ade80',
    bgColor: '#f0fdf4',
  },
  {
    id: 'sakura',
    name: '樱花暖粉',
    emoji: '🌸',
    appearance: 'light',
    themeColor: '#ec4899',
    themeColorDark: '#f472b6',
    bgColor: '#fdf2f8',
  },
  {
    id: 'amber',
    name: '琥珀暮色',
    emoji: '🌅',
    appearance: 'system',
    themeColor: '#f5a623',
    themeColorDark: '#fbbf24',
    bgColor: '#fef9ec',
  },
]

/** v3 纯色背景预设 */
export const BG_COLOR_PRESETS: string[] = [
  '#f7f8fa',
  '#eef2ff',
  '#f0fdf4',
  '#fef9ec',
  '#fdf2f8',
  '#17181c',
]

/** 全局快捷键默认绑定（Electron accelerator → 动作，主进程注册用） */
export const DEFAULT_SHORTCUTS: ReadonlyArray<{ action: ShortcutAction; accelerator: string }> = [
  { action: 'newTask', accelerator: 'CommandOrControl+Shift+N' },
  { action: 'quickTimer', accelerator: 'CommandOrControl+Shift+T' },
  { action: 'openSearch', accelerator: 'CommandOrControl+Shift+K' },
]

/** 专注记录下限（秒）：低于该时长的计时不计入任务用时与统计 */
export const MIN_FOCUS_RECORD_SEC = 5

/**
 * 桌宠可选自绘角色清单（Codex 风格，精灵帧动画，
 * 与 src/pet/src/sprite/petAssets.ts 的 PET_ASSETS 一一对应）。
 */
export const PET_CHARACTERS: PetCharacterInfo[] = [
  { id: 'bubcat', name: 'Codex' },
  { id: 'sprite', name: 'Terminal' },
  { id: 'bean', name: 'Pixel' },
]

/** 依据 ID 查角色清单项；未知 ID 回退到第一个（bubcat） */
export function getPetCharacter(id: PetCharacterId | string | undefined): PetCharacterInfo {
  return PET_CHARACTERS.find((m) => m.id === id) ?? PET_CHARACTERS[0]
}

/** 判断一个值是否为内置角色 ID（bubcat / sprite / bean，用于旧配置字段兜底与迁移） */
export function isBuiltinPetId(value: unknown): value is PetCharacterId {
  return PET_CHARACTERS.some((m) => m.id === value)
}

/** 兼容别名（历史命名，存量引用较多）：是否为内置角色 ID，委托 isBuiltinPetId */
export function isPetCharacterId(value: unknown): value is PetCharacterId {
  return isBuiltinPetId(value)
}

/**
 * 合并磁盘/备份读出的配置到完整 AppConfig（store.init 与备份导入共用）：
 * - 以 DEFAULT_CONFIG 兜底全部字段（含历史版本新增的可选字段）
 * - petPosition 逐字段合并
 * - selectedCharacter：非空字符串一律放行（内置 id 或用户导入的自定义宠物 id——
 *   自定义 id 为任意 normalizePetId 字符串，无法与拼错的内置名区分，故不做枚举
 *   校验；桌宠端加载时若该 id 不在资产注册表，运行时回落 bubcat 兜底）；
 *   仅 undefined / 空串时回落——优先迁移旧字段 selectedModel（Live2D 时代命名，
 *   仅内置 id 视为合法，QA O8），否则用默认值
 */
export function mergeConfig(loaded: unknown): AppConfig {
  const raw = (typeof loaded === 'object' && loaded !== null ? loaded : {}) as Record<string, unknown>
  const merged: AppConfig = { ...DEFAULT_CONFIG, ...(loaded as Partial<AppConfig>) }
  merged.petPosition = {
    ...DEFAULT_CONFIG.petPosition,
    ...((raw.petPosition as { x?: number; y?: number }) ?? {}),
  }
  if (typeof merged.selectedCharacter !== 'string' || merged.selectedCharacter === '') {
    // 旧配置仅存 selectedModel：合法内置 id 则迁移，否则回退默认
    merged.selectedCharacter = isBuiltinPetId(raw.selectedModel)
      ? (raw.selectedModel as PetCharacterId)
      : DEFAULT_CONFIG.selectedCharacter
  }
  return merged
}

/** 系统收集箱（v3 内置待办集：不可删除、不可重命名，固定置顶） */
export const INBOX_COLLECTION = {
  id: 'inbox',
  name: '收集箱',
  isSystem: true,
  sortOrder: 0,
  createdAt: '1970-01-01T00:00:00.000Z',
} as const

export const DEFAULT_DATA: FullData = {
  version: DATA_VERSION,
  tasks: [],
  overrides: [],
  goals: [],
  habits: [],
  sessions: [],
  collections: [{ ...INBOX_COLLECTION }],
  activities: [],
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

/** 任务预设分类（chips 快捷输入，仍可自由输入自定义分类） */
export const CATEGORY_PRESETS: string[] = ['工作', '生活', '学习', '其他']

/** 任务自定义颜色预设色板（hex） */
export const COLOR_PRESETS: string[] = [
  '#e5484d', // 红（高优先级）
  '#f5a623', // 琥珀（中优先级）
  '#3b82f6', // 蓝
  '#22c55e', // 绿
  '#8b5cf6', // 紫
  '#ec4899', // 粉
  '#14b8a6', // 青
  '#64748b', // 灰
]

/**
 * 解析任务展示颜色：有自定义 color 用之，否则回退优先级色 CSS 变量。
 * 纯函数，供日历 / 收集箱 / 周视图复用，保证颜色链路一致。
 */
export function taskColor(task: Pick<Task, 'color' | 'priority'>): string {
  const color = task.color && task.color.trim()
  return color ? color : `var(--priority-${task.priority})`
}
