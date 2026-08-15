/**
 * 系统托盘：常驻入口，支持唤回主窗口、显隐桌宠、退出应用。
 */
import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { getMainWindow, setPetVisible, setQuitting } from './windows'
import { store } from './store'

let tray: Tray | null = null

export function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Fantacy Todo List')

  const showMain = (): void => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }

  const refreshMenu = (): void => {
    const petVisible = store.getConfig().petVisible
    const menu = Menu.buildFromTemplate([
      { label: '显示主窗口', click: showMain },
      { label: petVisible ? '隐藏桌宠' : '显示桌宠', click: () => setPetVisible(!store.getConfig().petVisible) },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          setQuitting(true)
          app.quit()
        },
      },
    ])
    tray?.setContextMenu(menu)
  }

  refreshMenu()
  tray.on('click', showMain)
  tray.on('right-click', refreshMenu)
}
