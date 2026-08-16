/**
 * 自定义宠物包管理 IPC：保存 / 列表 / 删除 / 导出 / 导入（.petpack）。
 * 目录结构：userData/pets/<id>/{ pet.json, spritesheet.png, meta.json }。
 * .petpack = 标准 ZIP（store 模式不压缩）的三个条目，纯 Node 读写实现，无外部依赖。
 * 所有落盘路径的 id 分量一律经 normalizePetId 归一，杜绝路径注入。
 */
import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { IPC } from '../shared/ipc-channels'
import { PET_SHEET_H, PET_SHEET_W, normalizePetId, validatePetPackManifest, validatePetSheetSize } from '../shared/petPack'
import type { PetPackEntry, PetPackExportResult, PetPackImportResult, PetPackManifest, PetPackMeta } from '../shared/types'

/** 宠物包根目录（懒创建） */
function petsDir(): string {
  const dir = join(app.getPath('userData'), 'pets')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** 原子写：先写同目录 .tmp，再 rename 覆盖（同 backup.ts 口径，支持二进制） */
function atomicWrite(filePath: string, content: string | Buffer): void {
  const tmp = filePath + '.tmp'
  writeFileSync(tmp, content)
  renameSync(tmp, filePath)
}

function focusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

/**
 * 读 PNG IHDR 宽高（大端，位于字节 16-23）。
 * 签名（89 50 4E 47）不符或长度不足返回 null。
 */
function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

/** 校验 spritesheet 像素尺寸为 2880x208 */
function isValidSheetPng(buf: Buffer): boolean {
  const size = pngSize(buf)
  return size !== null && validatePetSheetSize(size.w, size.h)
}

/** 严格校验 base64（去空白后：长度为 4 的倍数、字符集合法、非空） */
function isBase64(s: string): boolean {
  const t = s.replace(/\s+/g, '')
  if (t.length === 0 || t.length % 4 !== 0) return false
  return /^[A-Za-z0-9+/]+={0,2}$/.test(t)
}

/* ---------------- ZIP（store 模式）纯 Node 实现 ---------------- */

/** CRC32 查表法（与 scripts/gen-icon.mjs 同款算法，zip / PNG 通用），表懒初始化 */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** zip 条目名白名单（三个允许名之外读回时忽略） */
const ZIP_ALLOWED_NAMES = new Set(['pet.json', 'spritesheet.png', 'meta.json'])

/** 打包 stored ZIP（method 0 不压缩）：Local File Header + 数据，末尾 Central Directory + EOCD */
function buildZip(entries: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf-8')
    const crc = crc32(e.data)
    // Local File Header（30 字节固定头 + 文件名 + 数据）
    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(0x04034b50, 0) // 签名
    lfh.writeUInt16LE(20, 4) // version needed（2.0）
    lfh.writeUInt16LE(0, 6) // flags
    lfh.writeUInt16LE(0, 8) // method：0 = stored 不压缩
    lfh.writeUInt16LE(0, 10) // mod time
    lfh.writeUInt16LE(0, 12) // mod date
    lfh.writeUInt32LE(crc, 14) // crc32
    lfh.writeUInt32LE(e.data.length, 18) // csize
    lfh.writeUInt32LE(e.data.length, 22) // usize
    lfh.writeUInt16LE(nameBuf.length, 26) // 文件名长度
    lfh.writeUInt16LE(0, 28) // extra 长度
    parts.push(lfh, nameBuf, e.data)
    // Central Directory Header（46 字节固定头 + 文件名）
    const cdh = Buffer.alloc(46)
    cdh.writeUInt32LE(0x02014b50, 0) // 签名
    cdh.writeUInt16LE(20, 4) // version made by
    cdh.writeUInt16LE(20, 6) // version needed
    cdh.writeUInt16LE(0, 8) // flags
    cdh.writeUInt16LE(0, 10) // method：stored
    cdh.writeUInt16LE(0, 12) // mod time
    cdh.writeUInt16LE(0, 14) // mod date
    cdh.writeUInt32LE(crc, 16)
    cdh.writeUInt32LE(e.data.length, 20) // csize
    cdh.writeUInt32LE(e.data.length, 24) // usize
    cdh.writeUInt16LE(nameBuf.length, 28)
    cdh.writeUInt16LE(0, 30) // extra 长度
    cdh.writeUInt16LE(0, 32) // comment 长度
    cdh.writeUInt16LE(0, 34) // disk 起始号
    cdh.writeUInt16LE(0, 36) // 内部属性
    cdh.writeUInt32LE(0, 38) // 外部属性
    cdh.writeUInt32LE(offset, 42) // 对应 Local File Header 偏移
    centrals.push(cdh, nameBuf)
    offset += 30 + nameBuf.length + e.data.length
  }
  const cd = Buffer.concat(centrals)
  // EOCD（22 字节固定尾）
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // 签名
  eocd.writeUInt16LE(0, 4) // 当前磁盘号
  eocd.writeUInt16LE(0, 6) // cd 起始磁盘号
  eocd.writeUInt16LE(entries.length, 8) // 本磁盘条目数
  eocd.writeUInt16LE(entries.length, 10) // 总条目数
  eocd.writeUInt32LE(cd.length, 12) // cd 字节大小
  eocd.writeUInt32LE(offset, 16) // cd 起始偏移
  eocd.writeUInt16LE(0, 20) // comment 长度
  return Buffer.concat([...parts, cd, eocd])
}

/**
 * 解包 stored ZIP：从尾部扫 EOCD（0x06054b50），逐条读 Central Directory，
 * 再到 Local File Header 取数据缓冲。
 * 防炸：条目数上限 16、偏移与大小越界即整体失败返回 null；
 * 名字白名单之外的条目直接忽略；非 stored 条目忽略。
 */
function readZip(buf: Buffer): Map<string, Buffer> | null {
  // EOCD 固定 22 字节，尾部最多再带 64KB 注释 → 向前扫描窗口 22 + 0xffff
  const scanStart = Math.max(0, buf.length - 22 - 0xffff)
  let eocd = -1
  for (let i = buf.length - 22; i >= scanStart; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const count = buf.readUInt16LE(eocd + 10)
  if (count > 16) return null
  let p = buf.readUInt32LE(eocd + 16)
  const out = new Map<string, Buffer>()
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const lfhOffset = buf.readUInt32LE(p + 42)
    if (p + 46 + nameLen > buf.length) return null
    const name = buf.toString('utf-8', p + 46, p + 46 + nameLen)
    p += 46 + nameLen + extraLen + commentLen
    if (!ZIP_ALLOWED_NAMES.has(name) || method !== 0) continue
    // 到 Local File Header 拿真实数据起点与长度
    if (lfhOffset + 30 > buf.length || buf.readUInt32LE(lfhOffset) !== 0x04034b50) return null
    const lNameLen = buf.readUInt16LE(lfhOffset + 26)
    const lExtraLen = buf.readUInt16LE(lfhOffset + 28)
    const dataStart = lfhOffset + 30 + lNameLen + lExtraLen
    if (dataStart + csize > buf.length) return null
    out.set(name, buf.subarray(dataStart, dataStart + csize))
  }
  return out
}

/* ---------------- 目录读取辅助 ---------------- */

/** 读单个宠物包目录 → 列表条目；目录缺失 / 文件损坏 / 校验不过返回 null（跳过） */
function readPackDir(dir: string): PetPackEntry | null {
  try {
    const manifestJson: unknown = JSON.parse(readFileSync(join(dir, 'pet.json'), 'utf-8'))
    const validated = validatePetPackManifest(manifestJson)
    if (!validated.ok) return null
    const metaJson: unknown = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf-8'))
    if (typeof metaJson !== 'object' || metaJson === null) return null
    const m = metaJson as Record<string, unknown>
    if (typeof m.id !== 'string' || typeof m.name !== 'string' || typeof m.createdAt !== 'string') return null
    const pngBuf = readFileSync(join(dir, 'spritesheet.png'))
    if (!isValidSheetPng(pngBuf)) return null
    return {
      meta: {
        id: m.id,
        name: m.name,
        sourceName: typeof m.sourceName === 'string' ? m.sourceName : undefined,
        createdAt: m.createdAt,
      },
      sheetDataUrl: `data:image/png;base64,${pngBuf.toString('base64')}`,
      // 附带已校验的 pet.json 清单（动画帧表），供桌宠端运行时加载渲染
      manifest: validated.manifest,
    }
  } catch {
    // 任一文件缺失 / JSON 损坏：跳过该目录
    return null
  }
}

export function registerPetPackIpc(): void {
  // 列表：遍历 petsDir 子目录，按 createdAt 升序返回
  ipcMain.handle(IPC.petPackList, (): PetPackEntry[] => {
    const root = petsDir()
    const dirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
    const entries: PetPackEntry[] = []
    for (const d of dirs) {
      const entry = readPackDir(join(root, d.name))
      if (entry) entries.push(entry)
    }
    entries.sort((a, b) => (a.meta.createdAt < b.meta.createdAt ? -1 : a.meta.createdAt > b.meta.createdAt ? 1 : 0))
    return entries
  })

  // 保存：校验 manifest 与 base64 → 校验 PNG 尺寸 → 原子写三文件
  ipcMain.handle(
    IPC.petPackSave,
    (_event, manifest: PetPackManifest, spritesheetBase64: string, sourceName?: string): PetPackMeta => {
      const validated = validatePetPackManifest(manifest)
      if (!validated.ok) throw new Error(validated.error)
      if (typeof spritesheetBase64 !== 'string' || !isBase64(spritesheetBase64)) {
        throw new Error('spritesheet base64 不合法')
      }
      const pngBuf = Buffer.from(spritesheetBase64.replace(/\s+/g, ''), 'base64')
      if (!isValidSheetPng(pngBuf)) throw new Error('spritesheet 尺寸不合法')
      // id 再归一一次，防路径注入（manifest 校验已归一，此处兜底）
      const id = normalizePetId(validated.manifest.id)
      const dir = join(petsDir(), id)
      mkdirSync(dir, { recursive: true })
      const meta: PetPackMeta = {
        id,
        name: validated.manifest.name,
        sourceName: sourceName ?? undefined,
        createdAt: new Date().toISOString(),
      }
      atomicWrite(join(dir, 'pet.json'), JSON.stringify(validated.manifest, null, 2))
      atomicWrite(join(dir, 'spritesheet.png'), pngBuf)
      atomicWrite(join(dir, 'meta.json'), JSON.stringify({ ...meta, sourceName: sourceName ?? null }, null, 2))
      return meta
    },
  )

  // 删除：id 归一后整目录移除（force：不存在也不报错）
  ipcMain.handle(IPC.petPackDelete, (_event, id: string): void => {
    const safeId = normalizePetId(id)
    rmSync(join(petsDir(), safeId), { recursive: true, force: true })
  })

  // 导出：petsDir/<id>/ 三文件 → stored ZIP → 用户选择路径
  ipcMain.handle(IPC.petPackExport, async (_event, id: string): Promise<PetPackExportResult> => {
    const safeId = normalizePetId(id)
    const dir = join(petsDir(), safeId)
    if (!existsSync(dir)) return { canceled: false, error: '宠物包不存在' }
    try {
      const metaJson: unknown = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf-8'))
      const displayName =
        typeof metaJson === 'object' && metaJson !== null && typeof (metaJson as Record<string, unknown>).name === 'string'
          ? ((metaJson as Record<string, unknown>).name as string)
          : safeId
      // 文件名去掉路径非法字符
      const fileName = displayName.replace(/[\\/:*?"<>|]/g, '').trim() || safeId
      const win = focusedWindow()
      const options = {
        defaultPath: `${fileName}.petpack`,
        filters: [{ name: 'Pet Pack', extensions: ['petpack'] }],
      }
      const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
      if (res.canceled || !res.filePath) return { canceled: true }
      const zip = buildZip([
        { name: 'pet.json', data: readFileSync(join(dir, 'pet.json')) },
        { name: 'spritesheet.png', data: readFileSync(join(dir, 'spritesheet.png')) },
        { name: 'meta.json', data: readFileSync(join(dir, 'meta.json')) },
      ])
      writeFileSync(res.filePath, zip)
      return { canceled: false, path: res.filePath }
    } catch (err) {
      return { canceled: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // 导入：用户选择 .petpack → 解包 → 校验 manifest 与 PNG 尺寸 → 原子写入 petsDir/<id>/
  ipcMain.handle(IPC.petPackImport, async (): Promise<PetPackImportResult> => {
    const win = focusedWindow()
    const options = {
      filters: [{ name: 'Pet Pack', extensions: ['petpack'] }],
      properties: ['openFile' as const],
    }
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (res.canceled || res.filePaths.length === 0) return { ok: false, error: '已取消' }

    try {
      const zipBuf = readFileSync(res.filePaths[0])
      const files = readZip(zipBuf)
      if (!files) return { ok: false, error: '不是合法的 .petpack 文件' }
      const petJson = files.get('pet.json')
      const sheetPng = files.get('spritesheet.png')
      if (!petJson || !sheetPng) return { ok: false, error: '宠物包缺少必需文件' }

      let manifestJson: unknown
      try {
        manifestJson = JSON.parse(petJson.toString('utf-8'))
      } catch {
        return { ok: false, error: 'pet.json 不是合法 JSON' }
      }
      const validated = validatePetPackManifest(manifestJson)
      if (!validated.ok) return { ok: false, error: validated.error }
      if (!isValidSheetPng(sheetPng)) return { ok: false, error: 'spritesheet 尺寸不合法' }

      // id 归一防路径注入；createdAt / sourceName 尽量保留包内原值
      const id = normalizePetId(validated.manifest.id)
      let oldMeta: Record<string, unknown> | null = null
      const metaEntry = files.get('meta.json')
      if (metaEntry) {
        try {
          const parsed: unknown = JSON.parse(metaEntry.toString('utf-8'))
          if (typeof parsed === 'object' && parsed !== null) oldMeta = parsed as Record<string, unknown>
        } catch {
          // meta.json 损坏则回退重建，不阻断导入
        }
      }
      const meta: PetPackMeta = {
        id,
        name: validated.manifest.name,
        sourceName: typeof oldMeta?.sourceName === 'string' ? oldMeta.sourceName : undefined,
        createdAt: typeof oldMeta?.createdAt === 'string' ? oldMeta.createdAt : new Date().toISOString(),
      }

      // 全部校验通过才落盘（校验失败已在上面 return，不触碰现有目录）
      const dir = join(petsDir(), id)
      mkdirSync(dir, { recursive: true })
      atomicWrite(join(dir, 'pet.json'), petJson)
      atomicWrite(join(dir, 'spritesheet.png'), sheetPng)
      atomicWrite(
        join(dir, 'meta.json'),
        JSON.stringify({ ...meta, sourceName: meta.sourceName ?? null }, null, 2),
      )
      return { ok: true, meta }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
