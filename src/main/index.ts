/**
 * 主进程入口：应用生命周期、初始化 store、注册 IPC、创建窗口与托盘。
 */
import { app, BrowserWindow } from 'electron'
import { registerDataIpc } from './ipc'
import { registerPetIpc } from './pet-ipc'
import { registerBackupIpc } from './backup'
import { registerTimerAssetsIpc } from './timer-assets'
import { store } from './store'
import { createMainWindow, createPetWindow, getMainWindow, setQuitting } from './windows'
import { createTray } from './tray'
import { pushGoals, pushTodayBubble, pushTodayTodos } from './today'
import { IPC_MAIN } from '../shared/ipc-channels'

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
    registerTimerAssetsIpc()
    createMainWindow()
    const petWin = createPetWindow()
    createTray()

    // 数据变更后：
    // 1) 立即通知主窗口（不防抖）——桌宠端完成/跳过任务后，主窗口 taskStore 立即刷新勾选状态；
    // 2) 推送今日待办气泡 / 浮层 / 倒数日目标（300ms 防抖，避免批量写反复推）。
    let bubbleTimer: NodeJS.Timeout | null = null
    store.onDataChanged(() => {
      getMainWindow()?.webContents.send(IPC_MAIN.dataChanged)
      if (bubbleTimer) clearTimeout(bubbleTimer)
      bubbleTimer = setTimeout(() => {
        bubbleTimer = null
        pushTodayBubble()
        pushTodayTodos()
        pushGoals()
      }, 300)
    })

    // 桌宠窗口就绪时补推一次（应用启动即提醒）。
    // 延迟到渲染进程完成订阅后再推，避免首条数据因竞态丢失。
    petWin.once('ready-to-show', () => {
      setTimeout(() => {
        pushTodayBubble()
        pushTodayTodos()
        pushGoals()
      }, 250)
    })

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
