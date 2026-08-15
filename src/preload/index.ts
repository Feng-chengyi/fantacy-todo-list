/**
 * 主窗口 preload：通过 contextBridge 暴露白名单方法 window.api。
 * 不泄露 ipcRenderer 原始对象，仅暴露强类型方法。
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  AppConfig,
  CreateTaskInput,
  ExportResult,
  FullData,
  ImportResult,
  OverrideAction,
  PomodoroState,
  RendererApi,
  RepeatOverride,
  Task,
  TaskStatus,
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
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.configGet),
  setConfig: (patch: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke(IPC.configSet, patch),
  showBubble: (text: string): Promise<void> => ipcRenderer.invoke(IPC.petShowBubble, text),
  setPetVisible: (visible: boolean): Promise<void> => ipcRenderer.invoke(IPC.petSetVisible, visible),
  notifyPomodoro: (state: PomodoroState): Promise<void> => ipcRenderer.invoke(IPC.petNotifyPomodoro, state),
  exportData: (): Promise<ExportResult> => ipcRenderer.invoke(IPC.dataExport),
  importData: (): Promise<ImportResult> => ipcRenderer.invoke(IPC.dataImport),
  minimize: (): Promise<void> => ipcRenderer.invoke(IPC.windowMinimize),
  close: (): Promise<void> => ipcRenderer.invoke(IPC.windowClose),
}

contextBridge.exposeInMainWorld('api', api)
