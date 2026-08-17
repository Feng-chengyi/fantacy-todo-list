/**
 * 数据备份 / 导出导入 IPC：主进程 dialog + fs + 原子写 + 先校验后覆盖。
 * v3：独立计时页下线，备份不再内联计时器资产（背景图/BGM）；主题背景图
 * 为本机 assets 落盘文件，含机器相关路径，导出时统一剥离。
 */
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import { format } from 'date-fns'
import { IPC } from '../shared/ipc-channels'
import { DATA_VERSION } from '../shared/defaults'
import { validateBackupBundle } from '../shared/validate'
import type { AppConfig, BackupBundle, ExportResult, ImportResult } from '../shared/types'
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
  // v3.2 通用文本导出（P2-1 主题 JSON / P2-4 时间轴周报共用）：
  // 保存对话框 + 原子写，不触碰任何应用数据
  ipcMain.handle(
    IPC.fileExportText,
    async (
      _event,
      input: { defaultName: string; content: string; filterName?: string; filterExt?: string },
    ): Promise<ExportResult> => {
      const ext = input.filterExt ?? 'txt'
      const win = focusedWindow()
      const options = {
        defaultPath: input.defaultName,
        filters: [{ name: input.filterName ?? ext.toUpperCase(), extensions: [ext] }],
      }
      const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
      if (res.canceled || !res.filePath) return { canceled: true }
      try {
        atomicWrite(res.filePath, input.content)
        return { canceled: false, path: res.filePath }
      } catch (err) {
        return { canceled: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  )

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
      const config = store.getConfig()
      const bundle: BackupBundle = {
        app: 'fantacy-todo-list',
        backupVersion: DATA_VERSION,
        exportedAt: new Date().toISOString(),
        data: store.getData(),
        // config.bgImage 为 data URL（可移植），随备份原样迁移
        config,
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
      const config: AppConfig = validated.config
      store.setData(validated.data)
      store.setConfig(config)
      return { canceled: false, data: validated.data, config }
    } catch (err) {
      return { canceled: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
