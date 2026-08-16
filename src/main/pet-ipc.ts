/**
 * 桌宠 / 窗口类 IPC handler：气泡转发、显隐、拖拽（主进程轮询绝对定位）、
 * 鼠标穿透、聚焦、打开面板、完成今日待办、退出。
 */
import { app, ipcMain, screen } from 'electron'
import { randomUUID } from 'crypto'
import { IPC, IPC_MAIN } from '../shared/ipc-channels'
import { todayStr } from '../shared/date'
import { getMainWindow, getPetSize, getPetWindow, resizePetWindow, setPetVisible } from './windows'
import { store } from './store'
import type { MainPanel, PetAnimNotice, PomodoroState, WorkAreaRect } from '../shared/types'

/** 拖拽轮询定时器与抓取偏移（光标相对窗口左上角，主进程 DIP 口径） */
let dragTimer: NodeJS.Timeout | null = null
let dragOffset = { x: 0, y: 0 }

/** 停止拖拽轮询并持久化最终位置 */
function stopDrag(persist: boolean): void {
  if (!dragTimer) return
  clearInterval(dragTimer)
  dragTimer = null
  if (persist) {
    const win = getPetWindow()
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition()
      store.setConfig({ petPosition: { x, y } })
    }
  }
}

export function registerPetIpc(): void {
  ipcMain.handle(IPC.petShowBubble, (_event, text: string): void => {
    getPetWindow()?.webContents.send(IPC_MAIN.petBubble, text)
  })

  ipcMain.handle(IPC.petSetVisible, (_event, visible: boolean): void => {
    setPetVisible(visible)
  })

  /**
   * 开始拖拽：主进程以 16ms 轮询光标并按「光标 - 抓取偏移」绝对定位窗口（全屏自由移动）。
   * 拖拽偏移修复：offset 与轮询定位全部在主进程以 DIP 口径计算（渲染端
   * screenX 在高 DPI / 多显示器下与 DIP 不一致，是旧版图像错位的根因），
   * 抓取点全程锁定 → 图像与光标精确同步、零漂移；不再钳制到工作区（桌宠可自由移动）。
   */
  ipcMain.handle(IPC.petBeginDrag, (): void => {
    const win = getPetWindow()
    if (!win || win.isDestroyed()) return
    const cursor = screen.getCursorScreenPoint()
    const [wx, wy] = win.getPosition()
    dragOffset = { x: cursor.x - wx, y: cursor.y - wy }
    // 抓取偏移按当前窗口尺寸钳制：异常大偏移（旧位置越界重建等）时收拢，保证
    // 光标始终落在窗口（角色热区）范围内，图像紧贴操作位置
    const size = getPetSize()
    dragOffset.x = Math.min(Math.max(dragOffset.x, 0), Math.max(0, size.width - 1))
    dragOffset.y = Math.min(Math.max(dragOffset.y, 0), Math.max(0, size.height - 1))
    if (dragTimer) clearInterval(dragTimer)
    const move = (): void => {
      const w = getPetWindow()
      if (!w || w.isDestroyed() || !w.isVisible()) {
        stopDrag(false)
        return
      }
      const p = screen.getCursorScreenPoint()
      // 关键：用 setBounds 显式重设缓存尺寸，而非 setPosition。
      // 透明 + 不可缩放窗口在 Windows 高 DPI 下被 setPosition 反复移动会递增膨胀
      // （Electron 已知 bug），setBounds 每帧重新断言尺寸杜绝窗口「越长越大」。
      // 尺寸来自主进程缓存 petSize（不在拖拽中调 getSize()，保留防膨胀语义）。
      const s = getPetSize()
      w.setBounds({
        x: Math.round(p.x - dragOffset.x),
        y: Math.round(p.y - dragOffset.y),
        width: s.width,
        height: s.height,
      })
    }
    move() // 立即定位一帧，消除开始拖拽的跳变
    dragTimer = setInterval(move, 16)
  })

  /** 结束拖拽：停止轮询并一次性持久化最终位置 */
  ipcMain.handle(IPC.petEndDrag, (): void => {
    stopDrag(true)
  })

  ipcMain.handle(IPC.petSetIgnoreMouse, (_event, ignore: boolean): void => {
    getPetWindow()?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  /** 桌宠渲染端上报所需窗口尺寸（中心锚定 resize，主进程缓存 petSize） */
  ipcMain.handle(IPC.petSetSize, (_event, size: { width: number; height: number }): void => {
    const width = Math.round(Number(size?.width))
    const height = Math.round(Number(size?.height))
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return
    resizePetWindow(width, height)
  })

  /** 读取桌宠当前所在显示器工作区（DIP，屏幕感知定位用） */
  ipcMain.handle(IPC.petGetWorkArea, (): WorkAreaRect => {
    const win = getPetWindow()
    const area = (win && !win.isDestroyed()
      ? screen.getDisplayMatching(win.getBounds())
      : screen.getPrimaryDisplay()
    ).workArea
    return { x: area.x, y: area.y, width: area.width, height: area.height }
  })

  ipcMain.handle(IPC.petNotifyPomodoro, (_event, state: PomodoroState): void => {
    getPetWindow()?.webContents.send(IPC_MAIN.petPomodoro, state)
  })

  // 主窗口 → 桌宠：联动动画通知（timing / finishing / jumping）
  ipcMain.handle(IPC.petNotifyAnim, (_event, notice: PetAnimNotice): void => {
    getPetWindow()?.webContents.send(IPC_MAIN.petAnim, notice)
  })

  ipcMain.handle(IPC.windowFocusMain, (): void => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  ipcMain.handle(IPC.windowOpenPanel, (_event, panel: MainPanel): void => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    win.webContents.send(IPC_MAIN.openPanel, panel)
  })

  ipcMain.handle(IPC.petCompleteTask, (_event, taskId: string): void => {
    const data = store.getData()
    const task = data.tasks.find((t) => t.id === taskId)
    if (!task) return
    const today = todayStr()
    if (task.repeat) {
      // 重复任务：单日完成走 override（与主窗口勾选一致）
      const existing = data.overrides.find((o) => o.taskId === taskId && o.occurrenceDate === today)
      if (existing) existing.action = 'done'
      else data.overrides.push({ id: randomUUID(), taskId, occurrenceDate: today, action: 'done' })
    } else {
      task.status = 'done'
      task.completedAt = new Date().toISOString()
      task.updatedAt = new Date().toISOString()
    }
    store.setData(data)
  })

  ipcMain.handle(IPC.windowMinimize, (): void => {
    getMainWindow()?.minimize()
  })

  ipcMain.handle(IPC.windowClose, (): void => {
    app.quit()
  })
}
