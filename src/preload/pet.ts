/**
 * 桌宠窗口 preload：通过 contextBridge 暴露白名单方法 window.petApi。
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC, IPC_MAIN } from '../shared/ipc-channels'
import type {
  AppConfig,
  MainPanel,
  PetAnimNotice,
  PetGoal,
  PetPackEntry,
  PetRendererApi,
  PomodoroState,
  TodayTodo,
  WorkAreaRect,
} from '../shared/types'

const petApi: PetRendererApi = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.configGet),
  setConfig: (patch: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke(IPC.configSet, patch),
  beginDrag: (): Promise<void> => ipcRenderer.invoke(IPC.petBeginDrag),
  endDrag: (): Promise<void> => ipcRenderer.invoke(IPC.petEndDrag),
  setVisible: (visible: boolean): Promise<void> => ipcRenderer.invoke(IPC.petSetVisible, visible),
  setIgnoreMouse: (ignore: boolean): Promise<void> => ipcRenderer.invoke(IPC.petSetIgnoreMouse, ignore),
  setSize: (size: { width: number; height: number }): Promise<void> => ipcRenderer.invoke(IPC.petSetSize, size),
  getWorkArea: (): Promise<WorkAreaRect> => ipcRenderer.invoke(IPC.petGetWorkArea),
  focusMain: (): Promise<void> => ipcRenderer.invoke(IPC.windowFocusMain),
  openPanel: (panel: MainPanel): Promise<void> => ipcRenderer.invoke(IPC.windowOpenPanel, panel),
  completeTask: (taskId: string): Promise<void> => ipcRenderer.invoke(IPC.petCompleteTask, taskId),
  petPackList: (): Promise<PetPackEntry[]> => ipcRenderer.invoke(IPC.petPackList),
  quit: (): Promise<void> => ipcRenderer.invoke(IPC.windowClose),
  onBubble: (cb: (text: string) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, text: string): void => cb(text)
    ipcRenderer.on(IPC_MAIN.petBubble, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.petBubble, listener)
  },
  onVisibility: (cb: (visible: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, visible: boolean): void => cb(visible)
    ipcRenderer.on(IPC_MAIN.petVisibility, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.petVisibility, listener)
  },
  onPomodoro: (cb: (state: PomodoroState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: PomodoroState): void => cb(state)
    ipcRenderer.on(IPC_MAIN.petPomodoro, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.petPomodoro, listener)
  },
  onAnim: (cb: (notice: PetAnimNotice) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, notice: PetAnimNotice): void => cb(notice)
    ipcRenderer.on(IPC_MAIN.petAnim, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.petAnim, listener)
  },
  onTodayTodos: (cb: (todos: TodayTodo[]) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, todos: TodayTodo[]): void => cb(todos)
    ipcRenderer.on(IPC_MAIN.petTodayTodos, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.petTodayTodos, listener)
  },
  onGoals: (cb: (goals: PetGoal[]) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, goals: PetGoal[]): void => cb(goals)
    ipcRenderer.on(IPC_MAIN.petGoals, listener)
    return () => ipcRenderer.removeListener(IPC_MAIN.petGoals, listener)
  },
}

contextBridge.exposeInMainWorld('petApi', petApi)
