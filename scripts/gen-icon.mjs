// 生成应用图标 resources/icon.png（256x256）与 resources/icon.ico（多尺寸 PNG 打包）。
// 纯 Node 实现（zlib 构造 PNG），无需任何外部依赖，保证打包时图标文件存在且合法。
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** 标准 CRC32（PNG chunk 校验用） */
function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** 组装一个 PNG chunk */
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** 生成一张 RGBA PNG（紫→粉渐变，带圆角遮罩） */
function makePng(size) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(size * stride)
  const radius = size * 0.22
  const cx = size / 2
  const cy = size / 2
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const i = y * stride + 1 + x * 4
      // 圆角外透明
      const dx = Math.max(Math.abs(x - cx) - (cx - radius), 0)
      const dy = Math.max(Math.abs(y - cy) - (cy - radius), 0)
      const dist = Math.sqrt(dx * dx + dy * dy)
      const alpha = dist > radius ? 0 : 255
      const t = (x + y) / (2 * (size - 1))
      const r = Math.round(108 + (255 - 108) * t)
      const g = Math.round(92 + (120 - 92) * t)
      const b = Math.round(231 + (176 - 231) * t)
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = alpha
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 把多张 PNG 打包成 ICO（每个尺寸一个 PNG 条目） */
function makeIco(pngs) {
  const count = pngs.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)
  const entries = []
  let offset = 6 + count * 16
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e[2] = 0
    e[3] = 0
    e.writeUInt16LE(1, 4) // planes
    e.writeUInt16LE(32, 6) // bit count
    e.writeUInt32LE(buf.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += buf.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)])
}

const outDir = resolve(__dirname, '../resources')
mkdirSync(outDir, { recursive: true })

const sizes = [16, 32, 48, 256]
const pngs = sizes.map((s) => ({ size: s, buf: makePng(s) }))
writeFileSync(resolve(outDir, 'icon.png'), pngs[pngs.length - 1].buf)
writeFileSync(resolve(outDir, 'icon.ico'), makeIco(pngs))
console.log('icon generated: resources/icon.png, resources/icon.ico')
