/**
 * 共享类型定义 —— 全工程唯一类型来源。
 * main / preload / renderer / pet 四方一律从此处 import type，禁止在各端重复声明。
 */

export type Priority = 'high' | 'medium' | 'low'
export type TaskStatus = 'pending' | 'done' | 'abandoned'
export type RepeatType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
export type OverrideAction = 'done' | 'skipped'

/**
 * 任务类型（v3 统一任务体系）：
 * - normal 普通待办（单次执行）
 * - habit 习惯任务（周期循环 + 每日打卡，原独立习惯模块降格为类型标签）
 * - goal 目标任务（长期推进 + 总进度 + 截止倒计时）
 */
export type TaskType = 'normal' | 'habit' | 'goal'

/** 计时类型：none 不计时 / stopwatch 正向计时 / countdown 倒计时 */
export type TimerKind = 'none' | 'stopwatch' | 'countdown'

/** 主窗口可调起的面板标识（桌宠右键快捷入口 / window:open-panel） */
export type MainPanel = 'today' | 'collections' | 'timeline' | 'stats' | 'goals' | 'settings'

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

/** 任务提醒：按天在指定时刻触发（HH:mm，24 小时制） */
export interface TaskReminder {
  /** 提醒时间 HH:mm（24 小时制），如 '09:00' */
  time: string
}

/** 任务（P0 核心实体） */
export interface Task {
  id: string
  title: string
  description?: string
  priority: Priority
  /** 安排/截止日期 YYYY-MM-DD；null = 无日期 */
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
  /** 任务提醒（缺省/空 = 不提醒） */
  reminder?: TaskReminder | null
  /** 任务类型（v3：普通 / 习惯 / 目标；旧数据缺省 = normal） */
  taskType?: TaskType
  /** 所属待办集 ID（v3：未归类 = 系统收集箱 INBOX_ID） */
  collectionId?: string
  /** 习惯打卡日期列表 YYYY-MM-DD（taskType=habit 专用） */
  habitCheckins?: string[]
  /** 目标总进度 0-100（taskType=goal 专用） */
  progressValue?: number
  /** 计时类型（v3：none / stopwatch / countdown；缺省 = stopwatch） */
  timerKind?: TimerKind
  /** 倒计时时长（秒，timerKind=countdown 专用） */
  countdownSec?: number
}

/** 待办集（项目/分组容器，v3 新增） */
export interface TaskCollection {
  id: string
  name: string
  /** 系统内置（收集箱固定 true：不可删除、不可重命名） */
  isSystem: boolean
  /** 排序权重（越小越靠前；收集箱固定置顶 0） */
  sortOrder: number
  /** ISO 8601 */
  createdAt: string
}

/** 时间轴操作记录条目（v3 新增：只增不改的流水日志） */
export interface ActivityLog {
  id: string
  /** 操作类型 */
  type: 'create' | 'complete' | 'reopen' | 'delete' | 'timer' | 'move' | 'edit' | 'checkin'
  /** 关联任务标题快照（任务删除后仍可读） */
  taskTitle: string
  /** 补充说明（如「移入 收集箱」「专注 25 分钟」） */
  detail?: string
  /** ISO 8601 */
  createdAt: string
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

/** 一次有效专注计时会话（时长 ≥ MIN_FOCUS_RECORD_SEC 才落库，统计的权威数据源） */
export interface FocusSession {
  id: string
  /** 绑定任务 ID；空串 = 自由计时 */
  taskId: string
  /** 会话开始（ISO 8601） */
  startedAt: string
  /** 会话结束（ISO 8601） */
  endedAt: string
  durationSec: number
  /** 重复任务实例日期 YYYY-MM-DD；自由/非重复计时为 null（重复计时日期隔离） */
  occurrenceDate?: string | null
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

/** 内置桌宠角色 ID（固定三员） */
export type BuiltinPetId = 'bubcat' | 'sprite' | 'bean'
/** 桌宠角色 ID：内置三员 + 用户导入的自定义宠物包 id（放宽为 string） */
export type PetCharacterId = string

/** 桌宠自绘角色清单项（shared 统一维护） */
export interface PetCharacterInfo {
  id: PetCharacterId
  /** 显示名（用于右键「切换角色」子菜单） */
  name: string
}

/** 应用配置 */
export interface AppConfig {
  petVisible: boolean
  petPosition: { x: number; y: number }
  petScale: number
  /** 桌宠当前自绘角色（旧配置字段 selectedModel 由 defaults.mergeConfig 迁移） */
  selectedCharacter: PetCharacterId
  confettiEnabled: boolean
  /** 0=周日 1=周一 */
  weekStart: number
  theme: string
  /** 月/周/日视图是否展示任务备注（截断） */
  showNotesInCalendar: boolean
  /** 备注截断长度（超长加「…」） */
  noteTruncateLength: number
  /** 新建任务默认提醒时间 HH:mm（缺省 09:00） */
  reminderDefaultTime?: string
  /** 提醒是否同时弹系统通知（缺省 true） */
  reminderSystemNotification?: boolean
  /** v3 主题外观：light 亮色 / dark 暗色 / system 跟随系统 */
  appearance?: 'light' | 'dark' | 'system'
  /** v3 主题色（hex，亮色模式主色；缺省 = 品牌紫） */
  themeColor?: string
  /** v3 主题色深色变体（hex，暗色模式主色；缺省 = 按 themeColor 查预设表回落） */
  themeColorDark?: string
  /** v3 主题预设包 ID（THEME_PRESETS 项 id；自定义配色后清除） */
  themePresetId?: string
  /** v3 背景模式：plain 纯色 / image 图片 */
  bgMode?: 'plain' | 'image'
  /** v3 纯色背景色（hex） */
  bgColor?: string
  /** v3 背景图（本地 assets 落盘后的 data URL；null = 未设置） */
  bgImage?: string | null
  /** v3 背景模糊度 0-40（px） */
  bgBlur?: number
  /** v3 界面透明度 0.5-1（弹窗/卡片等表面组件） */
  uiOpacity?: number
  /** v3 进行中计时器快照（页面刷新/重启后恢复计时进度；null = 无计时） */
  activeTimer?: TimerState | null
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
  reminder?: TaskReminder | null
  /** v3：任务类型（缺省 normal） */
  taskType?: TaskType
  /** v3：所属待办集（缺省收集箱） */
  collectionId?: string
  /** v3：计时时长（秒，倒计时专用） */
  countdownSec?: number
}

/** 业务数据全文（data.json） */
export interface FullData {
  version: number
  tasks: Task[]
  overrides: RepeatOverride[]
  goals: CountdownGoal[]
  habits: Habit[]
  /** 专注计时会话记录（统计的权威数据源；旧数据缺省由 store 回填 []） */
  sessions: FocusSession[]
  /** 待办集列表（v3；收集箱为系统内置首项；旧数据缺省由迁移回填） */
  collections: TaskCollection[]
  /** 时间轴操作记录（v3；上限保留最近 ACTIVITY_LOG_CAP 条） */
  activities: ActivityLog[]
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

/** 选择资产结果（canceled = 用户取消对话框） */
export interface AssetPickResult {
  canceled: boolean
  dataUrl?: string
}

/** 一次专注原子提交的结果（返回更新后的任务；未绑定任务为 null） */
export interface FocusCommitResult {
  task: Task | null
}

/** 主窗口 → 桌宠联动动画通知 */
export interface PetAnimNotice {
  /** timing = 正向计时进行中；finishing = 任务完成；jumping = 番茄专注完成 */
  anim: 'timing' | 'finishing' | 'jumping'
  /** timing 专用：计时开始（true）/ 结束（false） */
  active?: boolean
}

/**
 * 桌宠状态语义（主窗口页面态 → 桌宠联动的统一枚举，v3.1 N1.2）：
 * - idle：常规待机；
 * - empty：当前页面空状态（引导用户创建内容）；
 * - all-done：今日待办清空（庆祝）；
 * - focus：专注计时进行中；
 * - milestone：里程碑达成（目标到期 / 习惯连续等）。
 */
export type PetState = 'idle' | 'empty' | 'all-done' | 'focus' | 'milestone'

/** PetState → 桌宠气泡文案（EmptyState / 页面联动直接消费） */
export const PET_STATE_TIPS: Record<PetState, string> = {
  idle: '我在这里陪着你～',
  empty: '这里还空空的，来添加点什么吧！',
  'all-done': '今日待办全部完成，太棒啦！🎉',
  focus: '专注中，加油！',
  milestone: '里程碑达成，值得庆祝！🎉',
}

/** 宠物包动画键（7 组，与运行时一致） */
export type PetPackAnim = 'idle' | 'running-right' | 'running-left' | 'waving' | 'jumping' | 'timing' | 'finishing'

/** 宠物包 pet.json 对外格式（Codex 自定义宠物 v2 精简清单） */
export interface PetPackManifest {
  formatVersion: 2
  spec: 'codex-custom-pet-v2'
  id: string
  name: string
  frame: { width: number; height: number }
  spritesheet: { file: string; layout: 'horizontal'; frameCount: number }
  animations: Record<PetPackAnim, { frames: number[]; fps: number; loop: boolean }>
}

/** 宠物包元信息（meta.json） */
export interface PetPackMeta {
  id: string
  name: string
  /** 来源图片文件名（可选） */
  sourceName?: string
  createdAt: string
}

/** 宠物包清单条目（列表用） */
export interface PetPackEntry {
  meta: PetPackMeta
  /** spritesheet data URL（加载用；列表时可为空） */
  sheetDataUrl?: string
  /** pet.json 清单（含动画帧表；桌宠端加载渲染用，可选兼容旧调用方） */
  manifest?: PetPackManifest
}

/** 导出宠物包结果（canceled = 用户取消对话框） */
export interface PetPackExportResult {
  canceled: boolean
  path?: string
  error?: string
}

/** 导入宠物包结果（校验失败 error 有值且不落盘） */
export interface PetPackImportResult {
  ok: boolean
  meta?: PetPackMeta
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
 * 正向计时器状态（进行中的秒表，不跨端持久化）。
 * 迁入 shared 供主进程 / 渲染进程 / 桌宠共用。
 * elapsed = accumMs + (paused ? 0 : now - startedAt)；paused 时 startedAt 无效。
 */
export interface TimerState {
  /** 绑定的任务 ID；空字符串 = 自由计时（未绑定任务） */
  taskId: string
  /** 当前段起始毫秒时间戳（Date.now()） */
  startedAt: number
  /** 会话最初开始时刻（暂停/继续不重置，用于生成 FocusSession.startedAt） */
  beginAt: number
  /** 暂停前累计毫秒 */
  accumMs: number
  paused: boolean
  /** 重复任务的实例日期 YYYY-MM-DD；非重复任务为 null（重复计时日期隔离） */
  occurrenceDate: string | null
}

/** 全局快捷键动作（主进程 globalShortcut → 渲染进程 app:shortcut） */
export type ShortcutAction = 'newTask' | 'quickTimer' | 'openSearch'

/** 搜索结果（任务 + 匹配得分，得分越小越靠前） */
export interface SearchResult {
  task: Task
  score: number
}

/** 显示器工作区矩形（DIP），用于桌宠窗口与浮层的屏幕感知定位 */
export interface WorkAreaRect {
  x: number
  y: number
  width: number
  height: number
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
  /** v3 待办集：新增（收集箱不可新建重名由 UI 约束，main 校验系统项不可改删） */
  createCollection(input: { name: string }): Promise<TaskCollection>
  /** v3 待办集：重命名（系统收集箱拒绝） */
  renameCollection(id: string, name: string): Promise<TaskCollection>
  /** v3 待办集：删除（内部任务自动回流收集箱；系统收集箱拒绝） */
  deleteCollection(id: string): Promise<FullData>
  /** v3 待办集：拖拽排序（orderedIds 为自定义集合的新顺序） */
  reorderCollections(orderedIds: string[]): Promise<void>
  /** v3 任务批量：移入待办集（collectionId 为空 = 移回收集箱） */
  batchMoveTasks(taskIds: string[], collectionId: string): Promise<FullData>
  /** v3 任务批量：标记状态 */
  batchSetStatus(taskIds: string[], status: TaskStatus): Promise<FullData>
  /** v3 任务批量：删除 */
  batchDeleteTasks(taskIds: string[]): Promise<FullData>
  getConfig(): Promise<AppConfig>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  showBubble(text: string): Promise<void>
  setPetVisible(visible: boolean): Promise<void>
  exportData(): Promise<ExportResult>
  importData(): Promise<ImportResult>
  /** v3 主题：选择背景图片并落盘，返回 data URL（canceled = 用户取消） */
  pickBgImage(): Promise<AssetPickResult>
  /** v3 主题：清除背景图片（删除落盘文件） */
  clearBgImage(): Promise<void>
  /** 原子提交一次专注会话（追加 session + 累加绑定任务 durationSec，单次落盘） */
  commitFocusSession(session: FocusSession): Promise<FocusCommitResult>
  /** 删除单条专注会话（连带扣减绑定任务 durationSec），返回最新全量数据 */
  deleteFocusSession(sessionId: string): Promise<FullData>
  /** 清空 [from, to] 闭区间（本地日期口径）内全部专注会话，返回最新全量数据 */
  clearFocusSessions(from: string, to: string): Promise<FullData>
  /** 重置全部专注统计（清空会话，任务 durationSec 归零），返回最新全量数据 */
  resetFocusStats(): Promise<FullData>
  /** 通知桌宠播放联动动画（timing / finishing / jumping） */
  notifyPetAnim(notice: PetAnimNotice): Promise<void>
  /** 宠物包：列出已安装自定义宠物（含 spritesheet data URL） */
  petPackList(): Promise<PetPackEntry[]>
  /** 宠物包：保存（spritesheetPng 为 base64 不含 data: 前缀；manifest 经校验） */
  petPackSave(manifest: PetPackManifest, spritesheetBase64: string, sourceName?: string): Promise<PetPackMeta>
  /** 宠物包：删除已安装自定义宠物 */
  petPackDelete(id: string): Promise<void>
  /** 宠物包：导出 .petpack（zip）到用户选择路径；canceled = 用户取消 */
  petPackExport(id: string): Promise<PetPackExportResult>
  /** 宠物包：从用户选择的 .petpack 导入；校验失败返回 error 不落盘 */
  petPackImport(): Promise<PetPackImportResult>
  /** 订阅主进程推送的「打开面板」请求 */
  onOpenPanel(cb: (panel: MainPanel) => void): () => void
  /** 订阅主进程推送的「数据已变更」通知（触发 store 重载同步） */
  onDataChanged(cb: () => void): () => void
  /** 订阅主进程推送的「配置已变更」通知（桌宠右键/托盘等跨入口写配置后同步 configStore） */
  onConfigChanged(cb: (config: AppConfig) => void): () => void
  /** 订阅主进程推送的全局快捷键动作（newTask / quickTimer / openSearch） */
  onShortcut(cb: (action: ShortcutAction) => void): () => void
}

/**
 * 桌宠窗口 preload 暴露的 window.petApi。
 */
export interface PetRendererApi {
  getConfig(): Promise<AppConfig>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  /** 开始拖拽：主进程轮询光标并绝对定位窗口（实时跟随、零漂移） */
  beginDrag(): Promise<void>
  /** 结束拖拽：停止轮询并持久化窗口位置 */
  endDrag(): Promise<void>
  setVisible(visible: boolean): Promise<void>
  setIgnoreMouse(ignore: boolean): Promise<void>
  focusMain(): Promise<void>
  /** 调起主窗口并打开指定面板 */
  openPanel(panel: MainPanel): Promise<void>
  /** 完成今日待办（重复任务单日完成走 override） */
  completeTask(taskId: string): Promise<void>
  /** 宠物包：列出已安装自定义宠物（含 spritesheet data URL，切换角色用） */
  petPackList(): Promise<PetPackEntry[]>
  quit(): Promise<void>
  onBubble(cb: (text: string) => void): () => void
  onVisibility(cb: (visible: boolean) => void): () => void
  /** 订阅主窗口推送的联动动画通知（timing / finishing / jumping） */
  onAnim(cb: (notice: PetAnimNotice) => void): () => void
  /** 订阅主进程推送的今日待办列表（悬浮浮层数据源） */
  onTodayTodos(cb: (todos: TodayTodo[]) => void): () => void
  /** 订阅主进程推送的倒数日目标（悬浮浮层数据源） */
  onGoals(cb: (goals: PetGoal[]) => void): () => void
  /** 上报桌宠所需窗口尺寸（中心锚定 resize，主进程缓存 petSize） */
  setSize(size: { width: number; height: number }): Promise<void>
  /** 读取桌宠当前所在显示器工作区（DIP，屏幕感知定位用） */
  getWorkArea(): Promise<WorkAreaRect>
}
