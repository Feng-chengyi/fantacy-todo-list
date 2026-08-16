/**
 * 窗口管理：主窗口（日历待办）+ 桌宠窗口（2D 自绘）。
 */
import { BrowserWindow, screen, shell } from 'electron'
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
  // 位置钳制到所属显示器工作区内：默认 {1000,700} + 高 420 在 ≤1080p 屏幕会越界，
  // 旧配置也可能存有越界坐标，导致桌宠窗口完全不可见。钳制后若发生变化则落盘修正。
  const PET_W = 320
  const PET_H = 420
  const area = screen.getDisplayMatching({
    x: cfg.petPosition.x,
    y: cfg.petPosition.y,
    width: 1,
    height: 1,
  }).workArea
  const petX = Math.min(Math.max(cfg.petPosition.x, area.x), area.x + area.width - PET_W)
  const petY = Math.min(Math.max(cfg.petPosition.y, area.y), area.y + area.height - PET_H)
  if (petX !== cfg.petPosition.x || petY !== cfg.petPosition.y) {
    store.setConfig({ petPosition: { x: petX, y: petY } })
  }
  const win = new BrowserWindow({
    width: PET_W,
    height: PET_H,
    x: petX,
    y: petY,
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
      // 桌宠为纯 2D SVG/CSS 自绘，无本地文件资源需放行，开启 webSecurity 保证安全。
      webSecurity: true,
    },
  })
  petWindow = win

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('ready-to-show', () => {
    // 实时读配置判断可见性：cfg 是创建时快照，若期间配置变化（如导入备份）会误判
    if (store.getConfig().petVisible) win.showInactive()
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
  if (visible) {
    showPetWindow()
  } else {
    hidePetWindow()
  }
  // 通知桌宠窗口显隐变化（preload onVisibility 订阅）
  petWindow?.webContents.send(IPC_MAIN.petVisibility, visible)
}
