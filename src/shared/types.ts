/**
 * 共享类型定义 —— 全工程唯一类型来源。
 * main / preload / renderer / pet 四方一律从此处 import type，禁止在各端重复声明。
 */

export type Priority = 'high' | 'medium' | 'low'
export type TaskStatus = 'pending' | 'done' | 'abandoned'
export type RepeatType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
export type OverrideAction = 'done' | 'skipped'

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
}

/** 重复实例覆盖（单日独立完成/跳过） */
export interface RepeatOverride {
  id: string
  taskId: string
  occurrenceDate: string
  action: OverrideAction
}

/** 应用配置 */
export interface AppConfig {
  petVisible: boolean
  petPosition: { x: number; y: number }
  petScale: number
  confettiEnabled: boolean
  /** 0=周日 1=周一 */
  weekStart: number
  theme: string
  /** 番茄钟专注时长（分钟） */
  pomodoroFocusMinutes: number
  /** 番茄钟休息时长（分钟） */
  pomodoroBreakMinutes: number
}

/** 业务数据全文（data.json） */
export interface FullData {
  version: number
  tasks: Task[]
  overrides: RepeatOverride[]
}

/** 新建任务入参 */
export interface CreateTaskInput {
  title: string
  priority: Priority
  date: string | null
  description?: string
  repeat?: RepeatRule | null
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
  getConfig(): Promise<AppConfig>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  showBubble(text: string): Promise<void>
  setPetVisible(visible: boolean): Promise<void>
  notifyPomodoro(state: PomodoroState): Promise<void>
  exportData(): Promise<ExportResult>
  importData(): Promise<ImportResult>
  minimize(): Promise<void>
  close(): Promise<void>
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
  quit(): Promise<void>
  onBubble(cb: (text: string) => void): () => void
  onVisibility(cb: (visible: boolean) => void): () => void
  onPomodoro(cb: (state: PomodoroState) => void): () => void
}
