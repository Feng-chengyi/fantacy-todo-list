/**
 * 桌宠 / 窗口类 IPC handler：气泡转发、显隐、移窗、鼠标穿透、聚焦、退出。
 */
import { app, ipcMain } from 'electron'
import { IPC, IPC_MAIN } from '../shared/ipc-channels'
import { getMainWindow, getPetWindow, setPetVisible } from './windows'
import { store } from './store'
import type { PomodoroState } from '../shared/types'

export function registerPetIpc(): void {
  ipcMain.handle(IPC.petShowBubble, (_event, text: string): void => {
    getPetWindow()?.webContents.send(IPC_MAIN.petBubble, text)
  })

  ipcMain.handle(IPC.petSetVisible, (_event, visible: boolean): void => {
    setPetVisible(visible)
  })

  ipcMain.handle(IPC.petMoveWindow, (_event, payload: { dx: number; dy: number }): void => {
    const win = getPetWindow()
    if (!win) return
    const [x, y] = win.getPosition()
    const nx = x + Math.round(payload.dx)
    const ny = y + Math.round(payload.dy)
    win.setPosition(nx, ny)
    // 位置实时持久化（防抖），满足 Q6 记忆位置
    store.setConfig({ petPosition: { x: nx, y: ny } }, { debounce: true })
  })

  ipcMain.handle(IPC.petSetIgnoreMouse, (_event, ignore: boolean): void => {
    getPetWindow()?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.handle(IPC.petNotifyPomodoro, (_event, state: PomodoroState): void => {
    getPetWindow()?.webContents.send(IPC_MAIN.petPomodoro, state)
  })

  ipcMain.handle(IPC.windowFocusMain, (): void => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  ipcMain.handle(IPC.windowMinimize, (): void => {
    getMainWindow()?.minimize()
  })

  ipcMain.handle(IPC.windowClose, (): void => {
    app.quit()
  })
}
