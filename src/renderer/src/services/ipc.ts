/**
 * window.api 的强类型二次封装。
 * 约定：store 只经 services/ipc 访问 IPC，绝不直接触碰 window.api。
 */
import type {
  AppConfig,
  AssetPickResult,
  CountdownGoal,
  CreateTaskInput,
  ExportResult,
  FocusCommitResult,
  FocusSession,
  FullData,
  ImportResult,
  MainPanel,
  OverrideAction,
  PetAnimNotice,
  PetPackEntry,
  PetPackExportResult,
  PetPackImportResult,
  PetPackManifest,
  PetPackMeta,
  RepeatOverride,
  ShortcutAction,
  Task,
  TaskCollection,
  TaskStatus,
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

/** v3 待办集：新增 */
export function createCollection(input: { name: string }): Promise<TaskCollection> {
  return window.api.createCollection(input)
}

/** v3 待办集：重命名（系统收集箱会被 main 拒绝） */
export function renameCollection(id: string, name: string): Promise<TaskCollection> {
  return window.api.renameCollection(id, name)
}

/** v3 待办集：删除（内部任务回流收集箱），返回最新全量数据 */
export function deleteCollection(id: string): Promise<FullData> {
  return window.api.deleteCollection(id)
}

/** v3 待办集：拖拽排序 */
export function reorderCollections(orderedIds: string[]): Promise<void> {
  return window.api.reorderCollections(orderedIds)
}

/** v3 任务批量：移入待办集 */
export function batchMoveTasks(taskIds: string[], collectionId: string): Promise<FullData> {
  return window.api.batchMoveTasks(taskIds, collectionId)
}

/** v3 任务批量：标记状态 */
export function batchSetStatus(taskIds: string[], status: TaskStatus): Promise<FullData> {
  return window.api.batchSetStatus(taskIds, status)
}

/** v3 任务批量：删除 */
export function batchDeleteTasks(taskIds: string[]): Promise<FullData> {
  return window.api.batchDeleteTasks(taskIds)
}

/** v3 主题：选择背景图片并落盘 */
export function pickBgImage(): Promise<AssetPickResult> {
  return window.api.pickBgImage()
}

/** v3 主题：清除背景图片 */
export function clearBgImage(): Promise<void> {
  return window.api.clearBgImage()
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
