/**
 * 数据备份 / 导出导入 IPC：主进程 dialog + fs + 原子写 + 先校验后覆盖。
 * 备份内联计时器自定义资产（背景图 / BGM data URL），导入时落盘恢复并把配置
 * 路径改写为本机 assets 路径，保证跨机器迁移不丢资产（QA Bug 3）。
 */
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { extname, join } from 'path'
import { format } from 'date-fns'
import { IPC } from '../shared/ipc-channels'
import { validateBackupBundle } from '../shared/validate'
import { ASSET_MIME, buildDataUrl, extOfMime, parseDataUrl } from '../shared/assets'
import type { AppConfig, BackupBundle, ExportResult, ImportResult, TimerAssetBundle } from '../shared/types'
import { store } from './store'

function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp'
  writeFileSync(tmp, content, 'utf-8')
  renameSync(tmp, filePath)
}

function focusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

/** 读资产文件 → data URL（不存在或类型不支持返回 undefined） */
function assetToDataUrl(path: string | null | undefined): string | undefined {
  if (!path || !existsSync(path)) return undefined
  const mime = ASSET_MIME[extname(path).toLowerCase()]
  if (!mime) return undefined
  try {
    const base64 = readFileSync(path).toString('base64')
    return base64.length > 0 ? buildDataUrl(mime, base64) : undefined
  } catch {
    return undefined
  }
}

/**
 * 内联资产恢复：data URL → 解码落盘到本机 assets 目录（固定名覆盖），
 * 返回需要写入 config 的本机路径 patch。非法/缺省资产跳过（对应字段置 null）。
 */
function restoreAssets(assets: TimerAssetBundle | undefined): Partial<AppConfig> {
  const patch: Partial<AppConfig> = {}
  const kinds: [keyof TimerAssetBundle, 'timerBgPath' | 'timerBgmPath', string][] = [
    ['bg', 'timerBgPath', 'timer-bg'],
    ['bgm', 'timerBgmPath', 'timer-bgm'],
  ]
  for (const [key, configKey, baseName] of kinds) {
    const dataUrl = assets?.[key]
    const parsed = dataUrl ? parseDataUrl(dataUrl) : null
    const ext = parsed ? extOfMime(parsed.mime) : null
    if (parsed && ext) {
      mkdirSync(store.assetsDir, { recursive: true })
      const dest = join(store.assetsDir, `${baseName}${ext}`)
      writeFileSync(dest, Buffer.from(parsed.base64, 'base64'))
      patch[configKey] = dest
    } else {
      // 备份未包含该资产：清除本机旧路径，避免残留失效路径
      patch[configKey] = null
    }
  }
  return patch
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
      const config = store.getConfig()
      const assets: TimerAssetBundle = {
        bg: assetToDataUrl(config.timerBgPath),
        bgm: assetToDataUrl(config.timerBgmPath),
      }
      const bundle: BackupBundle = {
        app: 'fantacy-todo-list',
        backupVersion: 1,
        exportedAt: new Date().toISOString(),
        data: store.getData(),
        // 剥离机器相关的绝对路径（资产已内联，导入时按本机路径重建）
        config: { ...config, timerBgPath: null, timerBgmPath: null },
        assets,
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

      // 先恢复内联资产（落盘 + 本机路径 patch），再写数据与配置
      const assetPatch = restoreAssets(validated.assets)
      const config: AppConfig = { ...validated.config, ...assetPatch }

      // 先校验后覆盖：校验失败已在上面 return，不会触碰现有数据
      store.setData(validated.data)
      store.setConfig(config)
      return { canceled: false, data: validated.data, config }
    } catch (err) {
      return { canceled: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
