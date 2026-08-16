/**
 * 计时器面板资产（背景图 / BGM）IPC：
 * - pick：系统对话框选择文件 → 复制到 userData assets 目录（固定名覆盖）→ 配置记路径 → 返回 data URL。
 *   data URL 方案同时兼容 dev(http) 与 prod(file://)，规避 Chromium 对 http 页面加载
 *   file:// 子资源的拦截。
 * - clear：删除落盘文件并清空配置。
 * - load：启动时读配置路径，重新拼 data URL 返回给渲染端恢复。
 * MIME/扩展名映射统一来自 shared/assets（与备份内联资产共用一套口径）。
 */
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'fs'
import { extname, join } from 'path'
import { IPC } from '../shared/ipc-channels'
import { ASSET_MIME, buildDataUrl, isAssetExt } from '../shared/assets'
import { store } from './store'
import type { TimerAssetKind, TimerAssetPickResult, TimerAssets } from '../shared/types'

/** 资产大小上限（20MB），防止巨型文件拖垮渲染进程 */
const MAX_ASSET_BYTES = 20 * 1024 * 1024

/** 供对话框用的文件过滤器 */
const FILTERS: Record<TimerAssetKind, { name: string; extensions: string[] }> = {
  bg: { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
  bgm: { name: '音频', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'] },
}

/** 落盘目标路径（固定名：timer-bg.<ext> / timer-bgm.<ext>，重复选择即覆盖） */
function destPath(kind: TimerAssetKind, srcExt: string): string {
  const name = kind === 'bg' ? 'timer-bg' : 'timer-bgm'
  return join(store.assetsDir, `${name}${srcExt.toLowerCase()}`)
}

/** 读文件拼 data URL；文件不存在返回 null */
function toDataUrl(filePath: string | null | undefined): string | null {
  if (!filePath || !existsSync(filePath)) return null
  const mime = ASSET_MIME[extname(filePath).toLowerCase()]
  if (!mime) return null
  const buf = readFileSync(filePath)
  return buildDataUrl(mime, buf.toString('base64'))
}

/** 删除旧资产文件（可能带旧扩展名，统一按前缀清理一次） */
function removeOldAssets(prefix: string, keepPath?: string): void {
  if (!existsSync(store.assetsDir)) return
  // 只清理本次 kind 的固定前缀文件，避免误删其它资产
  for (const ext of Object.keys(ASSET_MIME)) {
    const p = join(store.assetsDir, `${prefix}${ext}`)
    if (p !== keepPath && existsSync(p)) rmSync(p)
  }
}

export function registerTimerAssetsIpc(): void {
  ipcMain.handle(IPC.timerPickAsset, (_event, kind: TimerAssetKind): Promise<TimerAssetPickResult> => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options = {
      filters: [FILTERS[kind]],
      properties: ['openFile' as const],
    }
    // 注意：dialog 是同步弹窗异步结果，但 handler 需同步返回值 → 用 async/await 包装
    return (async (): Promise<TimerAssetPickResult> => {
      const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      if (res.canceled || res.filePaths.length === 0) return { canceled: true }
      const src = res.filePaths[0]
      const ext = extname(src)
      if (!isAssetExt(ext)) return { canceled: true }
      if (statSync(src).size > MAX_ASSET_BYTES) {
        void dialog.showErrorBox('文件过大', '背景图 / 音乐需小于 20MB。')
        return { canceled: true }
      }
      mkdirSync(store.assetsDir, { recursive: true })
      const dest = destPath(kind, ext)
      removeOldAssets(kind === 'bg' ? 'timer-bg' : 'timer-bgm', dest)
      copyFileSync(src, dest)
      store.setConfig(kind === 'bg' ? { timerBgPath: dest } : { timerBgmPath: dest })
      return { canceled: false, dataUrl: toDataUrl(dest) ?? undefined }
    })()
  })

  ipcMain.handle(IPC.timerClearAsset, (_event, kind: TimerAssetKind): void => {
    removeOldAssets(kind === 'bg' ? 'timer-bg' : 'timer-bgm')
    store.setConfig(kind === 'bg' ? { timerBgPath: null } : { timerBgmPath: null })
  })

  ipcMain.handle(IPC.timerLoadAssets, (): TimerAssets => {
    const cfg = store.getConfig()
    return { bgUrl: toDataUrl(cfg.timerBgPath), bgmUrl: toDataUrl(cfg.timerBgmPath) }
  })
}
