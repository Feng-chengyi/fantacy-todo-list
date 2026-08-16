/**
 * 默认值与枚举映射 —— 数据文件首次初始化时写入的默认内容。
 */
import type { AppConfig, FullData, PetCharacterId, PetCharacterInfo, Priority, Task } from './types'

/** 数据格式版本号（data.json / 备份文件共用），导入时校验兼容性 */
export const DATA_VERSION = 1

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
}

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
 * 桌宠可选自绘角色清单（Codex 风格，纯 2D SVG 自绘，
 * 与 src/pet/src/procedural/characters.tsx 一一对应）。
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

/** 判断一个值是否为合法的角色 ID（用于旧配置文件缺失字段的兜底） */
export function isPetCharacterId(value: unknown): value is PetCharacterId {
  return PET_CHARACTERS.some((m) => m.id === value)
}

/**
 * 合并磁盘/备份读出的配置到完整 AppConfig（store.init 与备份导入共用）：
 * - 以 DEFAULT_CONFIG 兜底全部字段（含历史版本新增的可选字段）
 * - petPosition 逐字段合并
 * - 旧字段 selectedModel（Live2D 时代命名）迁移为 selectedCharacter（QA O8）；
 *   新字段优先，非法值回退默认
 */
export function mergeConfig(loaded: unknown): AppConfig {
  const raw = (typeof loaded === 'object' && loaded !== null ? loaded : {}) as Record<string, unknown>
  const merged: AppConfig = { ...DEFAULT_CONFIG, ...(loaded as Partial<AppConfig>) }
  merged.petPosition = {
    ...DEFAULT_CONFIG.petPosition,
    ...((raw.petPosition as { x?: number; y?: number }) ?? {}),
  }
  if (!isPetCharacterId(merged.selectedCharacter)) {
    // 旧配置仅存 selectedModel：合法则迁移，否则回退默认
    merged.selectedCharacter = isPetCharacterId(raw.selectedModel)
      ? (raw.selectedModel as PetCharacterId)
      : DEFAULT_CONFIG.selectedCharacter
  }
  return merged
}

export const DEFAULT_DATA: FullData = {
  version: DATA_VERSION,
  tasks: [],
  overrides: [],
  goals: [],
  habits: [],
  sessions: [],
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
