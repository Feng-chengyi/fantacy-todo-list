/**
 * 窗口管理：主窗口（日历待办）+ 桌宠窗口（Live2D）。
 */
import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { store } from './store'
import { IPC_MAIN } from '../shared/ipc-channels'

let mainWindow: BrowserWindow | null = null
let petWindow: BrowserWindow | null = null
let isQuitting = false

export function setQuitting(value: boolean): void {
  isQuitting = value
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getPetWindow(): BrowserWindow | null {
  return petWindow
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  mainWindow = win

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    mainWindow = null
  })

  // 外链统一交系统浏览器（本项目无外链，保险起见）
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const url = process.env['ELECTRON_RENDERER_URL']
  if (url) {
    win.loadURL(`${url}/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

export function createPetWindow(): BrowserWindow {
  const cfg = store.getConfig()
  const win = new BrowserWindow({
    width: 320,
    height: 420,
    x: cfg.petPosition.x,
    y: cfg.petPosition.y,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      // Live2D 模型资源在 file:// 下经 XHR/fetch 加载会被 CORS 拦截；
      // 资源全部本地打包、无任何网络请求，关闭 webSecurity 仅用于放行本地资源加载。
      webSecurity: false,
    },
  })
  petWindow = win

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('ready-to-show', () => {
    if (cfg.petVisible) win.showInactive()
  })
  // 关闭桌宠 = 隐藏（常驻托盘），真正退出由托盘「退出」触发
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => {
    petWindow = null
  })

  const url = process.env['ELECTRON_RENDERER_URL']
  if (url) {
    win.loadURL(`${url}/pet.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/pet.html'))
  }
  return win
}

export function showPetWindow(): void {
  if (!petWindow) {
    createPetWindow()
    return
  }
  petWindow.showInactive()
}

export function hidePetWindow(): void {
  petWindow?.hide()
}

export function setPetVisible(visible: boolean): void {
  // 先持久化再操作窗口：若桌宠窗口已被销毁需重建，createPetWindow 能读到正确的 petVisible
  store.setConfig({ petVisible: visible })
  if (visible) showPetWindow()
  else hidePetWindow()
  // 通知桌宠窗口显隐变化（preload onVisibility 订阅）
  petWindow?.webContents.send(IPC_MAIN.petVisibility, visible)
}
