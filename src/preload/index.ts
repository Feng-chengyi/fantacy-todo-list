/**
 * 主窗口 preload：通过 contextBridge 暴露白名单方法 window.api。
 * 不泄露 ipcRenderer 原始对象，仅暴露强类型方法。
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC, IPC_MAIN } from '../shared/ipc-channels'
import type {
  AppConfig,
  CountdownGoal,
  CreateTaskInput,
  ExportResult,
  FullData,
  Habit,
  ImportResult,
  MainPanel,
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
  createGoal: (input: { title: string; targetDate: string; category?: string; color?: string }): Promise<CountdownGoal> =>
    ipcRenderer.invoke(IPC.goalCreate, input),
  deleteGoal: (id: string): Promise<void> => ipcRenderer.invoke(IPC.goalDelete, id),
  createHabit: (input: { title: string }): Promise<Habit> => ipcRenderer.invoke(IPC.habitCreate, input),
  deleteHabit: (id: string): Promise<void> => ipcRenderer.invoke(IPC.habitDelete, id),
  toggleHabit: (id: string, date: string): Promise<Habit> =>
    ipcRenderer.invoke(IPC.habitToggle, { id, date }),
  setHabitArchived: (id: string, archived: boolean): Promise<Habit> =>
    ipcRenderer.invoke(IPC.habitSetArchived, { id, archived }),
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.configGet),
  setConfig: (patch: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke(IPC.configSet, patch),
  showBubble: (text: string): Promise<void> => ipcRenderer.invoke(IPC.petShowBubble, text),
  setPetVisible: (visible: boolean): Promise<void> => ipcRenderer.invoke(IPC.petSetVisible, visible),
  notifyPomodoro: (state: PomodoroState): Promise<void> => ipcRenderer.invoke(IPC.petNotifyPomodoro, state),
  exportData: (): Promise<ExportResult> => ipcRenderer.invoke(IPC.dataExport),
  importData: (): Promise<ImportResult> => ipcRenderer.invoke(IPC.dataImport),
  minimize: (): Promise<void> => ipcRenderer.invoke(IPC.windowMinimize),
  close: (): Promise<void> => ipcRenderer.invoke(IPC.windowClose),
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
}

contextBridge.exposeInMainWorld('api', api)
