/**
 * 窗口管理：主窗口（日历待办）+ 桌宠窗口（2D 自绘）。
 */
import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { store } from './store'
import { IPC_MAIN } from '../shared/ipc-channels'

/**
 * 桌宠窗口「初始默认尺寸」（DIP），仅用于首次创建 / 越界默认坐标钳制。
 * 实际尺寸由桌宠渲染端按角色帧 + 缩放上报（petSetSize → resizePetWindow 缓存到 petSize）。
 * 拖拽移动时必须用缓存 petSize 重新断言尺寸：透明 + 不可缩放窗口在高 DPI 下被 setPosition
 * 反复移动会递增膨胀（Electron/Windows 已知 bug），最终透明窗口铺满桌面导致拖不动。
 */
export const PET_WINDOW_W = 320
export const PET_WINDOW_H = 520

let mainWindow: BrowserWindow | null = null
let petWindow: BrowserWindow | null = null
let isQuitting = false

/** 桌宠窗口当前尺寸缓存（DIP，主进程权威） */
let petSize = { width: PET_WINDOW_W, height: PET_WINDOW_H }

export function setQuitting(value: boolean): void {
  isQuitting = value
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getPetWindow(): BrowserWindow | null {
  return petWindow
}

/** 读取桌宠窗口当前尺寸缓存（DIP） */
export function getPetSize(): { width: number; height: number } {
  return petSize
}

/**
 * 中心锚定调整桌宠窗口尺寸：宽度按差值一半水平平移（保持精灵水平居中），
 * y（顶边）不变（顶部锚定，避免气泡/浮层跳变）。窗口未创建时仅更新缓存。
 */
export function resizePetWindow(width: number, height: number): void {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const win = petWindow
  if (!win || win.isDestroyed()) {
    petSize = { width: w, height: h }
    return
  }
  const old = win.getBounds()
  const dx = Math.round((w - old.width) / 2)
  petSize = { width: w, height: h }
  win.setBounds({ x: old.x - dx, y: old.y, width: w, height: h })
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
  const area = screen.getDisplayMatching({
    x: cfg.petPosition.x,
    y: cfg.petPosition.y,
    width: 1,
    height: 1,
  }).workArea
  const petX = Math.min(Math.max(cfg.petPosition.x, area.x), area.x + area.width - PET_WINDOW_W)
  const petY = Math.min(Math.max(cfg.petPosition.y, area.y), area.y + area.height - PET_WINDOW_H)
  if (petX !== cfg.petPosition.x || petY !== cfg.petPosition.y) {
    store.setConfig({ petPosition: { x: petX, y: petY } })
  }
  const win = new BrowserWindow({
    width: PET_WINDOW_W,
    height: PET_WINDOW_H,
    x: petX,
    y: petY,
    transparent: true,
    frame: false,
    // 透明 + 无边框窗口若在构造时写 resizable:false，程序化移动会触发尺寸膨胀
    // （Electron/Windows 已知 bug）；先建为可缩放、随后立即锁回不可缩放规避之。
    resizable: true,
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

  win.setResizable(false)
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
