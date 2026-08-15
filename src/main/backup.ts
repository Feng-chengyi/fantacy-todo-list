/**
 * 数据备份 / 导出导入 IPC：主进程 dialog + fs + 原子写 + 先校验后覆盖。
 */
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import { format } from 'date-fns'
import { IPC } from '../shared/ipc-channels'
import { validateBackupBundle } from '../shared/validate'
import type { BackupBundle, ExportResult, ImportResult } from '../shared/types'
import { store } from './store'

function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp'
  writeFileSync(tmp, content, 'utf-8')
  renameSync(tmp, filePath)
}

function focusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

export function registerBackupIpc(): void {
  ipcMain.handle(IPC.dataExport, async (): Promise<ExportResult> => {
    const defaultName = `fantacy-backup-${format(new Date(), 'yyyyMMdd')}.json`
    const win = focusedWindow()
    const options = {
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    }
    const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)

    if (res.canceled || !res.filePath) return { canceled: true }

    try {
      const bundle: BackupBundle = {
        app: 'fantacy-todo-list',
        backupVersion: 1,
        exportedAt: new Date().toISOString(),
        data: store.getData(),
        config: store.getConfig(),
      }
      atomicWrite(res.filePath, JSON.stringify(bundle, null, 2))
      return { canceled: false, path: res.filePath }
    } catch (err) {
      return { canceled: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.dataImport, async (): Promise<ImportResult> => {
    const win = focusedWindow()
    const options = {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile' as const],
    }
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)

    if (res.canceled || res.filePaths.length === 0) return { canceled: true }
    const filePath = res.filePaths[0]

    try {
      let json: unknown
      try {
        json = JSON.parse(readFileSync(filePath, 'utf-8'))
      } catch {
        return { canceled: false, error: '备份文件不是合法 JSON' }
      }

      const validated = validateBackupBundle(json)
      if (!validated.ok) return { canceled: false, error: validated.error }

      // 先校验后覆盖：校验失败已在上面 return，不会触碰现有数据
      store.setData(validated.data)
      store.setConfig(validated.config)
      return { canceled: false, data: validated.data, config: validated.config }
    } catch (err) {
      return { canceled: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
