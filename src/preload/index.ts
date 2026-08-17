/**
 * 主窗口 preload：通过 contextBridge 暴露白名单方法 window.api。
 * 不泄露 ipcRenderer 原始对象，仅暴露强类型方法。
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC, IPC_MAIN } from '../shared/ipc-channels'
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
  RendererApi,
  RepeatOverride,
  ShortcutAction,
  Task,
  TaskCollection,
  TaskStatus,
  TextFileExportInput,
} from '../shared/types'

const api: RendererApi = {
  loadData: (): Promise<FullData> => ipcRenderer.invoke(IPC.dataLoad),
  createTask: (input: CreateTaskInput): Promise<Task> => ipcRenderer.invoke(IPC.taskCreate, input),
  updateTask: (id: string, patch: Partial<Task>): Promise<Task> =>
    ipcRenderer.invoke(IPC.taskUpdate, { id, patch }),
  deleteTask: (id: string): Promise<void> => ipcRenderer.invoke(IPC.taskDelete, id),
  moveTask: (id: string, date: string | null): Promise<Task> =>
    ipcRenderer.invoke(IPC.taskMove, { id, date }),
  setTaskStatus: (id: string, status: TaskStatus): Promise<Task> =>
    ipcRenderer.invoke(IPC.taskSetStatus, { id, status }),
  reorderInbox: (orderedIds: string[]): Promise<void> => ipcRenderer.invoke(IPC.taskReorderInbox, orderedIds),
  setOverride: (taskId: string, occurrenceDate: string, action: OverrideAction): Promise<RepeatOverride> =>
    ipcRenderer.invoke(IPC.overrideSet, { taskId, occurrenceDate, action }),
  clearOverride: (taskId: string, occurrenceDate: string): Promise<void> =>
    ipcRenderer.invoke(IPC.overrideClear, { taskId, occurrenceDate }),
  createGoal: (input: { title: string; targetDate: string; category?: string; color?: string }): Promise<CountdownGoal> =>
    ipcRenderer.invoke(IPC.goalCreate, input),
  deleteGoal: (id: string): Promise<void> => ipcRenderer.invoke(IPC.goalDelete, id),
  createCollection: (input: { name: string }): Promise<TaskCollection> =>
    ipcRenderer.invoke(IPC.collectionCreate, input),
  renameCollection: (id: string, name: string): Promise<TaskCollection> =>
    ipcRenderer.invoke(IPC.collectionRename, { id, name }),
  deleteCollection: (id: string): Promise<FullData> => ipcRenderer.invoke(IPC.collectionDelete, id),
  reorderCollections: (orderedIds: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC.collectionReorder, orderedIds),
  batchMoveTasks: (taskIds: string[], collectionId: string): Promise<FullData> =>
    ipcRenderer.invoke(IPC.taskBatchMove, { taskIds, collectionId }),
  batchSetStatus: (taskIds: string[], status: TaskStatus): Promise<FullData> =>
    ipcRenderer.invoke(IPC.taskBatchStatus, { taskIds, status }),
  batchDeleteTasks: (taskIds: string[]): Promise<FullData> =>
    ipcRenderer.invoke(IPC.taskBatchDelete, taskIds),
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.configGet),
  setConfig: (patch: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke(IPC.configSet, patch),
  showBubble: (text: string): Promise<void> => ipcRenderer.invoke(IPC.petShowBubble, text),
  setPetVisible: (visible: boolean): Promise<void> => ipcRenderer.invoke(IPC.petSetVisible, visible),
  notifyPetAnim: (notice: PetAnimNotice): Promise<void> => ipcRenderer.invoke(IPC.petNotifyAnim, notice),
  petPackList: (): Promise<PetPackEntry[]> => ipcRenderer.invoke(IPC.petPackList),
  petPackSave: (manifest: PetPackManifest, spritesheetBase64: string, sourceName?: string): Promise<PetPackMeta> =>
    ipcRenderer.invoke(IPC.petPackSave, manifest, spritesheetBase64, sourceName),
  petPackDelete: (id: string): Promise<void> => ipcRenderer.invoke(IPC.petPackDelete, id),
  petPackExport: (id: string): Promise<PetPackExportResult> => ipcRenderer.invoke(IPC.petPackExport, id),
  petPackImport: (): Promise<PetPackImportResult> => ipcRenderer.invoke(IPC.petPackImport),
  exportData: (): Promise<ExportResult> => ipcRenderer.invoke(IPC.dataExport),
  importData: (): Promise<ImportResult> => ipcRenderer.invoke(IPC.dataImport),
  pickBgImage: (): Promise<AssetPickResult> => ipcRenderer.invoke(IPC.uiPickBgImage),
  clearBgImage: (): Promise<void> => ipcRenderer.invoke(IPC.uiClearBgImage),
  exportTextFile: (input: TextFileExportInput): Promise<ExportResult> =>
    ipcRenderer.invoke(IPC.fileExportText, input),
  commitFocusSession: (session: FocusSession): Promise<FocusCommitResult> =>
    ipcRenderer.invoke(IPC.focusCommit, session),
  deleteFocusSession: (sessionId: string): Promise<FullData> =>
    ipcRenderer.invoke(IPC.statsDeleteSession, sessionId),
  clearFocusSessions: (from: string, to: string): Promise<FullData> =>
    ipcRenderer.invoke(IPC.statsClearRange, { from, to }),
  resetFocusStats: (): Promise<FullData> => ipcRenderer.invoke(IPC.statsResetAll),
  onOpenPanel: (cb: (panel: MainPanel) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, panel: MainPanel): void => cb(panel)
    ipcRenderer.on(IPC_MAIN.openPanel, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.openPanel, listener)
  },
  onDataChanged: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC_MAIN.dataChanged, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.dataChanged, listener)
  },
  onConfigChanged: (cb: (config: AppConfig) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, config: AppConfig): void => cb(config)
    ipcRenderer.on(IPC_MAIN.configChanged, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.configChanged, listener)
  },
  onShortcut: (cb: (action: ShortcutAction) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, action: ShortcutAction): void => cb(action)
    ipcRenderer.on(IPC_MAIN.shortcut, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.shortcut, listener)
  },
}

contextBridge.exposeInMainWorld('api', api)
