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
  pomodoroFocusMinutes: 25,
  pomodoroBreakMinutes: 5,
  showNotesInCalendar: true,
  noteTruncateLength: 30,
  timerBgPath: null,
  timerBgmPath: null,
  timerBgmVolume: 0.6,
  timerBgmAutoplay: false,
  timerDim: 0.35,
  timerClockStyle: 'digital',
  timerQuotes: [],
  reminderDefaultTime: '09:00',
  reminderSystemNotification: true,
  appearance: 'system',
  themeColor: '#6c5ce7',
  bgMode: 'plain',
  bgColor: '#f7f8fa',
  bgImage: null,
  bgBlur: 0,
  uiOpacity: 1,
  activeTimer: null,
}

/** v3 主题色预设（设置面板色板 + 深色变体映射） */
export const THEME_COLOR_PRESETS: { name: string; light: string; dark: string }[] = [
  { name: '品牌紫', light: '#6c5ce7', dark: '#8b7cf7' },
  { name: '海洋蓝', light: '#3b82f6', dark: '#60a5fa' },
  { name: '青竹绿', light: '#22c55e', dark: '#4ade80' },
  { name: '珊瑚红', light: '#e5484d', dark: '#f87171' },
  { name: '琥珀橙', light: '#f5a623', dark: '#fbbf24' },
  { name: '樱花粉', light: '#ec4899', dark: '#f472b6' },
  { name: '青碧青', light: '#14b8a6', dark: '#2dd4bf' },
  { name: '石墨灰', light: '#64748b', dark: '#94a3b8' },
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

/** 计时页内置励志文案池（用户未自定义 timerQuotes 时使用） */
export const DEFAULT_TIMER_QUOTES: string[] = [
  '专注当下，一件一件来。',
  '你不需要完美开始，只需要开始。',
  '每一段专注，都在悄悄改变你。',
  '慢一点没关系，别停下就好。',
  '把大事拆小，把小事做完。',
  '今天的努力，是明天的底气。',
  '心无旁骛，即是高效。',
  '完成比完美更重要。',
  '此刻的坚持，未来的你会感谢。',
  '少想多做，行动治愈焦虑。',
  '时间花在哪，答案就在哪。',
  '一次只做一件事，做到最好。',
  '所有的成长，都藏在重复里。',
  '别急着看结果，先享受过程。',
  '专注 25 分钟，胜过恍惚 2 小时。',
  '困难的事情，值得慢慢做。',
  '自律不是苦役，是自由的门票。',
  '今天的份内事，今天做完。',
  '稳住节奏，不被打扰带偏。',
  '小步前进，也是前进。',
]

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
