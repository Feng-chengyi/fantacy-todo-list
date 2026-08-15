/**
 * 主进程入口：应用生命周期、初始化 store、注册 IPC、创建窗口与托盘。
 */
import { app, BrowserWindow } from 'electron'
import { registerDataIpc } from './ipc'
import { registerPetIpc } from './pet-ipc'
import { registerBackupIpc } from './backup'
import { store } from './store'
import { createMainWindow, createPetWindow, getMainWindow, setQuitting } from './windows'
import { createTray } from './tray'
import { pushTodayBubble } from './today'

// 单实例锁：避免多开导致数据文件并发写
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.whenReady().then(() => {
    store.init()
    registerDataIpc()
    registerPetIpc()
    registerBackupIpc()
    createMainWindow()
    const petWin = createPetWindow()
    createTray()

    // 数据变更后推送今日待办气泡（300ms 防抖，避免批量写反复推）
    let bubbleTimer: NodeJS.Timeout | null = null
    store.onDataChanged(() => {
      if (bubbleTimer) clearTimeout(bubbleTimer)
      bubbleTimer = setTimeout(() => {
        bubbleTimer = null
        pushTodayBubble()
      }, 300)
    })

    // 桌宠窗口就绪时补推一次（应用启动即提醒）
    petWin.once('ready-to-show', () => pushTodayBubble())

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.on('before-quit', () => {
    setQuitting(true)
    // 退出前把防抖中的 config 落盘，避免丢位置/缩放
    store.flushConfig()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
