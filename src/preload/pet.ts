/**
 * 桌宠窗口 preload：通过 contextBridge 暴露白名单方法 window.petApi。
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC, IPC_MAIN } from '../shared/ipc-channels'
import type { AppConfig, MainPanel, PetGoal, PetRendererApi, PomodoroState, TodayTodo } from '../shared/types'

const petApi: PetRendererApi = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.configGet),
  setConfig: (patch: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke(IPC.configSet, patch),
  moveWindow: (dx: number, dy: number): Promise<void> => ipcRenderer.invoke(IPC.petMoveWindow, { dx, dy }),
  setVisible: (visible: boolean): Promise<void> => ipcRenderer.invoke(IPC.petSetVisible, visible),
  setIgnoreMouse: (ignore: boolean): Promise<void> => ipcRenderer.invoke(IPC.petSetIgnoreMouse, ignore),
  focusMain: (): Promise<void> => ipcRenderer.invoke(IPC.windowFocusMain),
  openPanel: (panel: MainPanel): Promise<void> => ipcRenderer.invoke(IPC.windowOpenPanel, panel),
  completeTask: (taskId: string): Promise<void> => ipcRenderer.invoke(IPC.petCompleteTask, taskId),
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
