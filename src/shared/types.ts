/**
 * 共享类型定义 —— 全工程唯一类型来源。
 * main / preload / renderer / pet 四方一律从此处 import type，禁止在各端重复声明。
 */

export type Priority = 'high' | 'medium' | 'low'
export type TaskStatus = 'pending' | 'done' | 'abandoned'
export type RepeatType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
export type OverrideAction = 'done' | 'skipped'

/** 主窗口可调起的面板标识（桌宠右键快捷入口 / window:open-panel） */
export type MainPanel = 'today' | 'stats' | 'habits' | 'goals' | 'pomodoro' | 'settings'

/** 重复规则（P0-04） */
export interface RepeatRule {
  type: RepeatType
  /** 间隔数；custom 时 = 每隔 N 天 */
  interval: number
  /** weekly：0=周日…6=周六，空数组 = 按创建日所在星期 */
  weekdays?: number[]
  /** monthly：1–31 */
  monthDay?: number
  /** yearly：1–12 */
  yearMonth?: number
  /** yearly：1–31 */
  yearDay?: number
  /** 重复结束日期 YYYY-MM-DD，null = 无限 */
  endDate?: string | null
  /** 重复次数上限，null = 无限 */
  endCount?: number | null
}

/** 任务（P0 核心实体） */
export interface Task {
  id: string
  title: string
  description?: string
  priority: Priority
  /** 安排日期 YYYY-MM-DD；null = 收集箱 */
  date: string | null
  status: TaskStatus
  /** ISO 8601 */
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  repeat?: RepeatRule | null
  /** 收集箱排序权重（仅收集箱项使用） */
  inboxOrder?: number | null
  tags: string[]
  /** 自定义分类（可自由输入或预设），缺省 = 未分类 */
  category?: string
  /** 自定义颜色（hex），缺省 = 回退优先级色 */
  color?: string
  /** 开始时间 HH:mm（24 小时制），与 endTime 成对；留空 = 全天 */
  startTime?: string
  /** 结束时间 HH:mm（24 小时制），需 > startTime */
  endTime?: string
  /** 正向计时完成实际用时（秒），完成时写入 */
  durationSec?: number
}

/** 重复实例覆盖（单日独立完成/跳过） */
export interface RepeatOverride {
  id: string
  taskId: string
  occurrenceDate: string
  action: OverrideAction
}

/** 倒数日目标 */
export interface CountdownGoal {
  id: string
  title: string
  /** 目标日期 YYYY-MM-DD */
  targetDate: string
  createdAt: string
  /** 自定义分类（可选，缺省 = 未分类） */
  category?: string
  /** 自定义颜色（hex，可选，缺省 = 回退强调色） */
  color?: string
}

/** 习惯（打卡） */
export interface Habit {
  id: string
  title: string
  /** 已打卡日期列表（YYYY-MM-DD） */
  checkins: string[]
  /** 归档/停用：保留历史但不再要求每日打卡（缺省 = false） */
  archived?: boolean
}

/** 桌宠可选角色模型 ID */
export type PetModelId = 'haru' | 'hiyori' | 'natori' | 'mao' | 'wanko' | 'rice'

/** 桌宠角色模型清单项（shared 统一维护） */
export interface PetModelInfo {
  id: PetModelId
  /** 显示名（用于右键「切换角色」子菜单） */
  name: string
  /** 相对 pet.html 所在目录的 model3.json 路径 */
  path: string
}

/** 应用配置 */
export interface AppConfig {
  petVisible: boolean
  petPosition: { x: number; y: number }
  petScale: number
  /** 桌宠当前角色模型 */
  selectedModel: PetModelId
  confettiEnabled: boolean
  /** 0=周日 1=周一 */
  weekStart: number
  theme: string
  /** 番茄钟专注时长（分钟） */
  pomodoroFocusMinutes: number
  /** 番茄钟休息时长（分钟） */
  pomodoroBreakMinutes: number
  /** 月/周/日视图是否展示任务备注（截断） */
  showNotesInCalendar: boolean
  /** 备注截断长度（超长加「…」） */
  noteTruncateLength: number
}

/** 业务数据全文（data.json） */
export interface FullData {
  version: number
  tasks: Task[]
  overrides: RepeatOverride[]
  goals: CountdownGoal[]
  habits: Habit[]
}

/** 新建任务入参 */
export interface CreateTaskInput {
  title: string
  priority: Priority
  date: string | null
  description?: string
  repeat?: RepeatRule | null
  category?: string
  color?: string
  startTime?: string
  endTime?: string
}

/** 日历上的一次任务实例（含重复展开结果） */
export interface Occurrence {
  task: Task
  /** YYYY-MM-DD 实例日期 */
  date: string
  /** skipped = 被 override 跳过（UI 层通常隐藏） */
  status: TaskStatus | 'skipped'
}

/** 今日待办（气泡提醒用，主进程计算） */
export interface TodayTodo {
  taskId: string
  title: string
  priority: Priority
}

/** 桌宠悬浮浮层展示的倒数日目标（主进程计算剩余天数） */
export interface PetGoal {
  id: string
  title: string
  targetDate: string
  /** 剩余天数：正数 = 未来，0 = 当天，负数 = 已过 */
  daysLeft: number
  category: string
  color: string
}

/** 番茄钟阶段 */
export type PomodoroPhase = 'focus' | 'break' | 'idle'

/** 番茄钟状态（同步给桌宠的陪伴状态） */
export interface PomodoroState {
  phase: PomodoroPhase
  remainingSeconds: number
  totalSeconds: number
}

/** 备份文件格式（单文件，data + config） */
export interface BackupBundle {
  app: string
  backupVersion: number
  exportedAt: string
  data: FullData
  config: AppConfig
}

/** 导出备份结果 */
export interface ExportResult {
  canceled: boolean
  path?: string
  error?: string
}

/** 导入备份结果 */
export interface ImportResult {
  canceled: boolean
  data?: FullData
  config?: AppConfig
  error?: string
}

/**
 * 主窗口 preload 暴露的 window.api（类型与 preload/index.ts 实现一致）。
 * 统一在 shared 定义，preload 与 renderer 的 env.d.ts 共同引用。
 */
export interface RendererApi {
  loadData(): Promise<FullData>
  createTask(input: CreateTaskInput): Promise<Task>
  updateTask(id: string, patch: Partial<Task>): Promise<Task>
  deleteTask(id: string): Promise<void>
  moveTask(id: string, date: string | null): Promise<Task>
  setTaskStatus(id: string, status: TaskStatus): Promise<Task>
  reorderInbox(orderedIds: string[]): Promise<void>
  setOverride(taskId: string, occurrenceDate: string, action: OverrideAction): Promise<RepeatOverride>
  clearOverride(taskId: string, occurrenceDate: string): Promise<void>
  createGoal(input: { title: string; targetDate: string; category?: string; color?: string }): Promise<CountdownGoal>
  deleteGoal(id: string): Promise<void>
  createHabit(input: { title: string }): Promise<Habit>
  deleteHabit(id: string): Promise<void>
  toggleHabit(id: string, date: string): Promise<Habit>
  setHabitArchived(id: string, archived: boolean): Promise<Habit>
  getConfig(): Promise<AppConfig>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  showBubble(text: string): Promise<void>
  setPetVisible(visible: boolean): Promise<void>
  notifyPomodoro(state: PomodoroState): Promise<void>
  exportData(): Promise<ExportResult>
  importData(): Promise<ImportResult>
  minimize(): Promise<void>
  close(): Promise<void>
  /** 订阅主进程推送的「打开面板」请求 */
  onOpenPanel(cb: (panel: MainPanel) => void): () => void
  /** 订阅主进程推送的「数据已变更」通知（触发 store 重载同步） */
  onDataChanged(cb: () => void): () => void
}

/**
 * 桌宠窗口 preload 暴露的 window.petApi。
 */
export interface PetRendererApi {
  getConfig(): Promise<AppConfig>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  moveWindow(dx: number, dy: number): Promise<void>
  setVisible(visible: boolean): Promise<void>
  setIgnoreMouse(ignore: boolean): Promise<void>
  focusMain(): Promise<void>
  /** 调起主窗口并打开指定面板 */
  openPanel(panel: MainPanel): Promise<void>
  /** 完成今日待办（重复任务单日完成走 override） */
  completeTask(taskId: string): Promise<void>
  quit(): Promise<void>
  onBubble(cb: (text: string) => void): () => void
  onVisibility(cb: (visible: boolean) => void): () => void
  onPomodoro(cb: (state: PomodoroState) => void): () => void
  /** 订阅主进程推送的今日待办列表（悬浮浮层数据源） */
  onTodayTodos(cb: (todos: TodayTodo[]) => void): () => void
  /** 订阅主进程推送的倒数日目标（悬浮浮层数据源） */
  onGoals(cb: (goals: PetGoal[]) => void): () => void
}
