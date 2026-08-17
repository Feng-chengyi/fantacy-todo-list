/**
 * v3 主题背景图资产 IPC（独立计时页已下线，原计时器背景图/BGM 资产链路同步移除）：
 * - pick：系统对话框选择图片 → 复制到 userData assets 目录（固定名覆盖）→
 *   配置存 data URL → 返回 data URL。data URL 方案同时兼容 dev(http) 与
 *   prod(file://)，规避 Chromium 对 http 页面加载 file:// 子资源的拦截。
 * - clear：删除落盘文件并清空配置。
 * MIME/扩展名映射来自 shared/assets（导出备份与背景选择共用一套口径）。
 */
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'fs'
import { extname, join } from 'path'
import { IPC } from '../shared/ipc-channels'
import { ASSET_MIME, buildDataUrl, isAssetExt } from '../shared/assets'
import { store } from './store'
import type { AssetPickResult } from '../shared/types'

/** 资产大小上限（20MB），防止巨型文件拖垮渲染进程 */
const MAX_ASSET_BYTES = 20 * 1024 * 1024

/** 供对话框用的文件过滤器（仅图片；音频随计时页 BGM 下线） */
const IMAGE_FILTERS = { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }

/** 落盘目标路径（固定名 theme-bg.<ext>，重复选择即覆盖） */
function themeBgPath(srcExt: string): string {
  return join(store.assetsDir, `theme-bg${srcExt.toLowerCase()}`)
}

/** 读文件拼 data URL；文件不存在返回 null */
function toDataUrl(filePath: string | null | undefined): string | null {
  if (!filePath || !existsSync(filePath)) return null
  const mime = ASSET_MIME[extname(filePath).toLowerCase()]
  if (!mime) return null
  const buf = readFileSync(filePath)
  return buildDataUrl(mime, buf.toString('base64'))
}

/** 删除旧背景图文件（可能带旧扩展名，统一按前缀清理一次） */
function removeOldThemeBg(keepPath?: string): void {
  if (!existsSync(store.assetsDir)) return
  for (const ext of Object.keys(ASSET_MIME)) {
    const p = join(store.assetsDir, `theme-bg${ext}`)
    if (p !== keepPath && existsSync(p)) rmSync(p)
  }
}

export function registerUiAssetsIpc(): void {
  ipcMain.handle(IPC.uiPickBgImage, (): Promise<AssetPickResult> => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options = {
      filters: [IMAGE_FILTERS],
      properties: ['openFile' as const],
    }
    return (async (): Promise<AssetPickResult> => {
      const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      if (res.canceled || res.filePaths.length === 0) return { canceled: true }
      const src = res.filePaths[0]
      const ext = extname(src)
      if (!isAssetExt(ext)) return { canceled: true }
      if (statSync(src).size > MAX_ASSET_BYTES) {
        void dialog.showErrorBox('文件过大', '背景图需小于 20MB。')
        return { canceled: true }
      }
      mkdirSync(store.assetsDir, { recursive: true })
      const dest = themeBgPath(ext)
      removeOldThemeBg(dest)
      copyFileSync(src, dest)
      const dataUrl = toDataUrl(dest)
      store.setConfig({ bgImage: dataUrl })
      return { canceled: false, dataUrl: dataUrl ?? undefined }
    })()
  })

  ipcMain.handle(IPC.uiClearBgImage, (): void => {
    removeOldThemeBg()
    store.setConfig({ bgImage: null })
  })
}
