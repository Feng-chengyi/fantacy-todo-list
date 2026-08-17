/**
 * 全局快捷键（主进程）：注册默认三键 → 转发 app:shortcut 给主窗口渲染进程分发。
 * - CommandOrControl+Shift+N → newTask
 * - CommandOrControl+Shift+T → quickTimer（快捷计时：收集箱临时任务 + 直接开表）
 * - CommandOrControl+Shift+K → openSearch
 * 注册失败仅 console.warn（不抛错，避免因系统占用导致应用启动失败）。
 */
import { globalShortcut } from 'electron'
import { DEFAULT_SHORTCUTS } from '../shared/defaults'
import { IPC_MAIN } from '../shared/ipc-channels'
import { getMainWindow } from './windows'

/** 注册全部默认快捷键 */
export function registerShortcuts(): void {
  for (const { action, accelerator } of DEFAULT_SHORTCUTS) {
    let ok = false
    try {
      ok = globalShortcut.register(accelerator, () => {
        getMainWindow()?.webContents.send(IPC_MAIN.shortcut, action)
      })
    } catch (err) {
      console.warn(`[shortcuts] 注册快捷键异常：${accelerator}`, err)
      continue
    }
    if (!ok) console.warn(`[shortcuts] 注册快捷键失败：${accelerator}（可能被系统占用）`)
  }
}

/** 注销全部快捷键（应用退出前调用；内部 unregisterAll） */
export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
