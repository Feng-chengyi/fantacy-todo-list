/**
 * window.api 的强类型二次封装。
 * 约定：store 只经 services/ipc 访问 IPC，绝不直接触碰 window.api。
 */
import type {
  AppConfig,
  CountdownGoal,
  CreateTaskInput,
  ExportResult,
  FocusCommitResult,
  FocusSession,
  FullData,
  Habit,
  ImportResult,
  MainPanel,
  OverrideAction,
  PetAnimNotice,
  PetPackEntry,
  PetPackExportResult,
  PetPackImportResult,
  PetPackManifest,
  PetPackMeta,
  PomodoroState,
  RepeatOverride,
  ShortcutAction,
  Task,
  TaskStatus,
  TimerAssetKind,
  TimerAssetPickResult,
  TimerAssets,
} from '../../../shared/types'

export function loadData(): Promise<FullData> {
  return window.api.loadData()
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return window.api.createTask(input)
}

export function updateTask(id: string, patch: Partial<Task>): Promise<Task> {
  return window.api.updateTask(id, patch)
}

export function deleteTask(id: string): Promise<void> {
  return window.api.deleteTask(id)
}

export function moveTask(id: string, date: string | null): Promise<Task> {
  return window.api.moveTask(id, date)
}

export function setTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return window.api.setTaskStatus(id, status)
}

export function reorderInbox(orderedIds: string[]): Promise<void> {
  return window.api.reorderInbox(orderedIds)
}

export function setOverride(
  taskId: string,
  occurrenceDate: string,
  action: OverrideAction,
): Promise<RepeatOverride> {
  return window.api.setOverride(taskId, occurrenceDate, action)
}

export function clearOverride(taskId: string, occurrenceDate: string): Promise<void> {
  return window.api.clearOverride(taskId, occurrenceDate)
}

export function createGoal(input: {
  title: string
  targetDate: string
  category?: string
  color?: string
}): Promise<CountdownGoal> {
  return window.api.createGoal(input)
}

export function deleteGoal(id: string): Promise<void> {
  return window.api.deleteGoal(id)
}

export function createHabit(input: { title: string }): Promise<Habit> {
  return window.api.createHabit(input)
}

export function deleteHabit(id: string): Promise<void> {
  return window.api.deleteHabit(id)
}

export function toggleHabit(id: string, date: string): Promise<Habit> {
  return window.api.toggleHabit(id, date)
}

export function setHabitArchived(id: string, archived: boolean): Promise<Habit> {
  return window.api.setHabitArchived(id, archived)
}

export function onOpenPanel(cb: (panel: MainPanel) => void): () => void {
  return window.api.onOpenPanel(cb)
}

export function onDataChanged(cb: () => void): () => void {
  return window.api.onDataChanged(cb)
}

/** 订阅主进程推送的「配置已变更」（桌宠右键/托盘等跨入口写配置后同步 configStore） */
export function onConfigChanged(cb: (config: AppConfig) => void): () => void {
  return window.api.onConfigChanged(cb)
}

/** 订阅主进程推送的全局快捷键动作（newTask / openTimer / openSearch） */
export function onShortcut(cb: (action: ShortcutAction) => void): () => void {
  return window.api.onShortcut(cb)
}

export function getConfig(): Promise<AppConfig> {
  return window.api.getConfig()
}

export function setConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  return window.api.setConfig(patch)
}

export function showBubble(text: string): Promise<void> {
  return window.api.showBubble(text)
}

export function setPetVisible(visible: boolean): Promise<void> {
  return window.api.setPetVisible(visible)
}

export function notifyPomodoro(state: PomodoroState): Promise<void> {
  return window.api.notifyPomodoro(state)
}

/** 通知桌宠播放联动动画（timing / finishing / jumping） */
export function notifyPetAnim(notice: PetAnimNotice): Promise<void> {
  return window.api.notifyPetAnim(notice)
}

/** 宠物包：列出已安装自定义宠物（含 spritesheet data URL） */
export function petPackList(): Promise<PetPackEntry[]> {
  return window.api.petPackList()
}

/** 宠物包：保存（spritesheetBase64 不含 data: 前缀） */
export function petPackSave(
  manifest: PetPackManifest,
  spritesheetBase64: string,
  sourceName?: string,
): Promise<PetPackMeta> {
  return window.api.petPackSave(manifest, spritesheetBase64, sourceName)
}

/** 宠物包：删除已安装自定义宠物 */
export function petPackDelete(id: string): Promise<void> {
  return window.api.petPackDelete(id)
}

/** 宠物包：导出 .petpack 到用户选择路径 */
export function petPackExport(id: string): Promise<PetPackExportResult> {
  return window.api.petPackExport(id)
}

/** 宠物包：从用户选择的 .petpack 导入 */
export function petPackImport(): Promise<PetPackImportResult> {
  return window.api.petPackImport()
}

export function exportData(): Promise<ExportResult> {
  return window.api.exportData()
}

export function importData(): Promise<ImportResult> {
  return window.api.importData()
}

export function timerPickAsset(kind: TimerAssetKind): Promise<TimerAssetPickResult> {
  return window.api.timerPickAsset(kind)
}

export function timerClearAsset(kind: TimerAssetKind): Promise<void> {
  return window.api.timerClearAsset(kind)
}

export function timerLoadAssets(): Promise<TimerAssets> {
  return window.api.timerLoadAssets()
}

export function commitFocusSession(session: FocusSession): Promise<FocusCommitResult> {
  return window.api.commitFocusSession(session)
}

/** 删除单条专注会话（统计页单条删除），返回最新全量数据 */
export function deleteFocusSession(sessionId: string): Promise<FullData> {
  return window.api.deleteFocusSession(sessionId)
}

/** 清空指定日期区间（闭区间）内全部专注会话，返回最新全量数据 */
export function clearFocusSessions(from: string, to: string): Promise<FullData> {
  return window.api.clearFocusSessions(from, to)
}

/** 重置全部专注统计，返回最新全量数据 */
export function resetFocusStats(): Promise<FullData> {
  return window.api.resetFocusStats()
}

export function minimize(): Promise<void> {
  return window.api.minimize()
}

export function close(): Promise<void> {
  return window.api.close()
}
