// 生成 Codex 风格桌宠像素资产（纯 Node，无外部依赖）：
// 每角色输出 src/pet/assets/<id>/{pet.json, spritesheet.png}。
//
// 规范（Codex 自定义宠物 v2）：
// - 单帧 192x208（48x52 网格 x4 放大，硬边像素风、透明背景）
// - spritesheet 横排 15 帧：idle(2) running-right(2) running-left(2) waving(2)
//   jumping(2) timing(2) finishing(3)
// - pet.json 描述帧布局与动画元数据
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = resolve(__dirname, '../src/pet/assets')

/* ============ PNG 编码（RGBA，filter 0） ============ */

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

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** RGBA 像素数组 → PNG buffer */
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = width * 4 + 1
  const raw = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ============ 像素网格 DSL ============ */

const GW = 48 // 网格宽
const GH = 52 // 网格高
const SCALE = 4 // 放大倍数 → 192x208

/** 调色板槽位约定（索引 → RGBA） */
const SLOT = {
  TRANSPARENT: 0,
  BODY: 1,
  BODY_DARK: 2,
  OUTLINE: 3,
  GLOW: 4,
  GLOW_DIM: 5,
  PALE: 6,
  SHADOW: 7,
  EXTRA_A: 8,
  EXTRA_B: 9,
  EXTRA_C: 10,
}

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

class Grid {
  constructor() {
    this.data = new Uint8Array(GW * GH)
  }
  get(x, y) {
    return this.data[y * GW + x]
  }
  set(x, y, c) {
    if (x < 0 || x >= GW || y < 0 || y >= GH) return
    this.data[y * GW + x] = c
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c)
  }
  /** 硬边椭圆填充（cell 级判定，无抗锯齿） */
  ellipse(cx, cy, rx, ry, c) {
    for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) {
      for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
        const dx = (i - cx) / rx
        const dy = (j - cy) / ry
        if (dx * dx + dy * dy <= 1) this.set(i, j, c)
      }
    }
  }
  mirror() {
    const g = new Grid()
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) g.set(GW - 1 - x, y, this.get(x, y))
    return g
  }
  /** 对角色主体（非透明、非阴影）外圈描 1 格硬边轮廓 */
  outline(c) {
    const marks = []
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (this.get(x, y) !== SLOT.TRANSPARENT) continue
        const near =
          (x > 0 && this.isBody(x - 1, y)) ||
          (x < GW - 1 && this.isBody(x + 1, y)) ||
          (y > 0 && this.isBody(x, y - 1)) ||
          (y < GH - 1 && this.isBody(x, y + 1))
        if (near) marks.push([x, y])
      }
    }
    for (const [x, y] of marks) this.set(x, y, c)
  }
  isBody(x, y) {
    const c = this.get(x, y)
    return c !== SLOT.TRANSPARENT && c !== SLOT.SHADOW
  }
}

/* ============ 角色调色板 ============ */

function makePalette(role) {
  // [slot] = [r,g,b,a]
  const p = new Array(16).fill(null).map(() => [0, 0, 0, 0])
  const put = (slot, rgb, a = 255) => (p[slot] = [...rgb, a])
  if (role === 'bubcat') {
    // Codex：深蓝紫胶囊 + 荧光青
    put(SLOT.BODY, hex('#3d3d5c'))
    put(SLOT.BODY_DARK, hex('#2b2b44'))
    put(SLOT.OUTLINE, hex('#14141f'))
    put(SLOT.GLOW, hex('#3ee6b0'))
    put(SLOT.GLOW_DIM, hex('#2bc494'))
    put(SLOT.PALE, hex('#e9edff'))
  } else if (role === 'sprite') {
    // Terminal：终端机身 + 屏幕脸
    put(SLOT.BODY, hex('#484866'))
    put(SLOT.BODY_DARK, hex('#34344e'))
    put(SLOT.OUTLINE, hex('#16161f'))
    put(SLOT.GLOW, hex('#3ee6b0'))
    put(SLOT.GLOW_DIM, hex('#2bc494'))
    put(SLOT.PALE, hex('#e9edff'))
    put(SLOT.EXTRA_A, hex('#ff6b6b')) // 窗口栏红点
    put(SLOT.EXTRA_B, hex('#ffd166')) // 黄点
    put(SLOT.EXTRA_C, hex('#10101c')) // 屏幕
  } else {
    // Pixel：荧光豆
    put(SLOT.BODY, hex('#7de08a'))
    put(SLOT.BODY_DARK, hex('#58b96a'))
    put(SLOT.OUTLINE, hex('#1f4a2c'))
    put(SLOT.GLOW, hex('#12331f'))
    put(SLOT.GLOW_DIM, hex('#9fffb0'))
    put(SLOT.PALE, hex('#eafff0'))
    put(SLOT.EXTRA_A, hex('#4d9e3f')) // 茎
    put(SLOT.EXTRA_B, hex('#5cb85c')) // 叶
  }
  put(SLOT.SHADOW, [15, 15, 28], 90)
  return p
}

/* ============ 姿势绘制 ============ */

/**
 * 绘制一帧角色。
 * pose 参数：
 * - squash: 0/1/2 压扁档位（身体高度 -0/-1/-2，宽 +0/+1/+2）
 * - lift: 底部离地格数（跳起）
 * - blink: 眨眼
 * - eyesDx: 瞳孔偏移（-1/0/1，朝向）
 * - legs: 'stand' | 'run0' | 'run1' | 'tucked'
 * - armL/armR: 'down' | 'run0' | 'run1' | 'up0' | 'up1'
 * - lamp: null | 'on' | 'off'（胸口指示灯，timing 用）
 * - speedLines: -1（朝右跑，线在左）| 0 | 1
 * - stars: 四周星点（finishing 终帧）
 */
function drawFrame(role, pose) {
  const g = new Grid()
  const { squash, lift, blink, eyesDx, legs, armL, armR, lamp, speedLines, stars } = pose

  const groundY = 48 // 脚底基准线（阴影中心 ~49）
  // 阴影（随 lift 缩小）
  const shRx = lift > 0 ? 9 : 12
  g.ellipse(24, 49, shRx, 2, SLOT.SHADOW)

  // 身体中心与半径（squash 压扁）
  const ry = 15 - squash
  const rx = 13 + Math.floor(squash / 2)
  const bodyBottom = groundY - lift
  const cy = bodyBottom - ry
  // 腿（画在身体下、阴影上）
  const legTop = bodyBottom - 2
  if (legs === 'stand') {
    g.rect(17, legTop, 4, lift > 0 ? 2 : 4, SLOT.OUTLINE)
    g.rect(27, legTop, 4, lift > 0 ? 2 : 4, SLOT.OUTLINE)
  } else if (legs === 'tucked') {
    g.rect(17, legTop, 4, 2, SLOT.OUTLINE)
    g.rect(27, legTop, 4, 2, SLOT.OUTLINE)
  } else if (legs === 'run0') {
    g.rect(15, legTop, 4, 5, SLOT.OUTLINE) // 左腿前伸
    g.rect(29, legTop - 1, 4, 4, SLOT.OUTLINE) // 右腿后收抬起
  } else {
    g.rect(15, legTop - 1, 4, 4, SLOT.OUTLINE)
    g.rect(29, legTop, 4, 5, SLOT.OUTLINE)
  }

  // 手臂
  const drawArm = (side, mode) => {
    // side: -1 左 / +1 右
    const ax = side < 0 ? 11 : 33
    if (mode === 'down') g.rect(ax, cy + 6, 3, 7, SLOT.BODY_DARK)
    else if (mode === 'run0') g.rect(side < 0 ? ax + 2 : ax - 2, cy + 4, 3, 6, SLOT.BODY_DARK)
    else if (mode === 'run1') g.rect(ax, cy + 6, 3, 6, SLOT.BODY_DARK)
    else if (mode === 'up0') g.rect(side < 0 ? ax - 1 : ax + 1, cy - 12, 3, 8, SLOT.BODY_DARK)
    else if (mode === 'up1') g.rect(side < 0 ? ax - 2 : ax + 2, cy - 15, 3, 9, SLOT.BODY_DARK)
  }
  drawArm(-1, armL)
  drawArm(1, armR)

  // 身体主体
  g.ellipse(24, cy, rx, ry, SLOT.BODY)
  // 底部体积暗面
  for (let j = cy + ry - 5; j <= cy + ry; j++)
    for (let i = Math.floor(24 - rx); i <= Math.ceil(24 + rx); i++)
      if (g.get(i, j) === SLOT.BODY) g.set(i, j, SLOT.BODY_DARK)

  // 角色专属头部装饰
  if (role === 'bubcat') {
    // 天线：杆 + 荧光球
    g.rect(23, cy - ry - 4, 2, 5, SLOT.OUTLINE)
    g.rect(23, cy - ry - 7, 2, 2, pose.lamp === 'off' ? SLOT.GLOW_DIM : SLOT.GLOW)
  } else if (role === 'sprite') {
    // 终端窗口栏（顶部横条 + 三点）
    const barY = cy - ry + 2
    for (let i = Math.floor(24 - rx + 2); i <= Math.ceil(24 + rx - 2); i++)
      if (g.get(i, barY) === SLOT.BODY) g.set(i, barY, SLOT.BODY_DARK)
    g.set(24 - rx + 4, barY, SLOT.EXTRA_A)
    g.set(24 - rx + 6, barY, SLOT.EXTRA_B)
    g.set(24 - rx + 8, barY, SLOT.GLOW)
  } else {
    // 嫩芽：茎 + 双叶
    g.rect(23, cy - ry - 3, 2, 4, SLOT.EXTRA_A)
    g.rect(20, cy - ry - 4, 3, 2, SLOT.EXTRA_B)
    g.rect(25, cy - ry - 5, 3, 2, SLOT.EXTRA_B)
  }

  // 眼睛（角色脸部特征）
  if (role === 'sprite') {
    // Terminal：屏幕脸 + 光标眼
    const scrY = cy + 1
    for (let j = scrY; j < scrY + 8; j++)
      for (let i = 24 - rx + 4; i <= 24 + rx - 4; i++)
        if (g.get(i, j) === SLOT.BODY || g.get(i, j) === SLOT.BODY_DARK) g.set(i, j, SLOT.EXTRA_C)
    if (blink) {
      g.rect(24 - rx + 7, scrY + 3, 5, 1, SLOT.GLOW_DIM)
      g.rect(24 + rx - 12, scrY + 3, 5, 1, SLOT.GLOW_DIM)
    } else {
      g.rect(24 - rx + 7 + eyesDx, scrY + 1, 3, 4, SLOT.GLOW)
      g.rect(24 + rx - 10 + eyesDx, scrY + 1, 3, 4, SLOT.GLOW)
    }
  } else {
    // Codex / Pixel：方瞳 + 高光点
    const eyeY = cy + 2
    if (blink) {
      g.rect(17, eyeY + 2, 5, 2, role === 'bean' ? SLOT.GLOW : SLOT.GLOW_DIM)
      g.rect(26, eyeY + 2, 5, 2, role === 'bean' ? SLOT.GLOW : SLOT.GLOW_DIM)
    } else {
      const c = role === 'bean' ? SLOT.GLOW : SLOT.GLOW
      g.rect(17 + eyesDx, eyeY, 5, 4, c)
      g.rect(26 + eyesDx, eyeY, 5, 4, c)
      g.set(18 + eyesDx, eyeY + 1, SLOT.PALE)
      g.set(27 + eyesDx, eyeY + 1, SLOT.PALE)
    }
  }

  // 嘴（微笑 3 格）
  g.rect(22, cy + 9, 4, 1, role === 'bean' ? SLOT.GLOW : SLOT.GLOW_DIM)

  // 胸口指示灯（timing）
  if (lamp === 'on') g.rect(22, cy + 13, 4, 2, SLOT.GLOW)
  else if (lamp === 'off') g.rect(22, cy + 13, 4, 2, SLOT.BODY_DARK)

  // 跑动动势线（身后 2 条短横线）
  if (speedLines !== 0) {
    const lx = speedLines < 0 ? 2 : 42 // 朝右跑 → 线在左
    g.rect(lx, cy + 2, 4, 1, SLOT.GLOW_DIM)
    g.rect(lx + 1, cy + 6, 3, 1, SLOT.GLOW_DIM)
  }

  // 庆祝星点（finishing 终帧）
  if (stars) {
    g.rect(6, 10, 2, 2, SLOT.GLOW)
    g.rect(40, 8, 2, 2, SLOT.GLOW)
    g.rect(43, 26, 2, 2, SLOT.GLOW)
    g.rect(3, 30, 2, 2, SLOT.GLOW)
  }

  // 统一硬边描边（最后一步；阴影色不参与轮廓，outline 内部已排除）
  g.outline(SLOT.OUTLINE)
  return g
}

/* ============ 帧表（15 帧/角色） ============ */

function buildFrames(role) {
  const idle0 = drawFrame(role, {
    squash: 0, lift: 0, blink: false, eyesDx: 0, legs: 'stand',
    armL: 'down', armR: 'down', lamp: null, speedLines: 0, stars: false,
  })
  const idle1 = drawFrame(role, {
    squash: 1, lift: 0, blink: true, eyesDx: 0, legs: 'stand',
    armL: 'down', armR: 'down', lamp: null, speedLines: 0, stars: false,
  })
  const runR0 = drawFrame(role, {
    squash: 1, lift: 1, blink: false, eyesDx: 1, legs: 'run0',
    armL: 'run0', armR: 'run1', lamp: null, speedLines: -1, stars: false,
  })
  const runR1 = drawFrame(role, {
    squash: 0, lift: 0, blink: false, eyesDx: 1, legs: 'run1',
    armL: 'run1', armR: 'run0', lamp: null, speedLines: -1, stars: false,
  })
  const runL0 = runR0.mirror()
  const runL1 = runR1.mirror()
  const wave0 = drawFrame(role, {
    squash: 0, lift: 0, blink: false, eyesDx: 0, legs: 'stand',
    armL: 'down', armR: 'up0', lamp: null, speedLines: 0, stars: false,
  })
  const wave1 = drawFrame(role, {
    squash: 1, lift: 0, blink: false, eyesDx: 0, legs: 'stand',
    armL: 'down', armR: 'up1', lamp: null, speedLines: 0, stars: false,
  })
  const jump0 = drawFrame(role, {
    squash: 0, lift: 3, blink: false, eyesDx: 0, legs: 'tucked',
    armL: 'up0', armR: 'up0', lamp: null, speedLines: 0, stars: false,
  })
  const jump1 = drawFrame(role, {
    squash: 2, lift: 0, blink: true, eyesDx: 0, legs: 'stand',
    armL: 'down', armR: 'down', lamp: null, speedLines: 0, stars: false,
  })
  const timing0 = drawFrame(role, {
    squash: 0, lift: 0, blink: false, eyesDx: 0, legs: 'stand',
    armL: 'down', armR: 'down', lamp: 'on', speedLines: 0, stars: false,
  })
  const timing1 = drawFrame(role, {
    squash: 1, lift: 0, blink: false, eyesDx: 0, legs: 'stand',
    armL: 'down', armR: 'down', lamp: 'off', speedLines: 0, stars: false,
  })
  const fin0 = drawFrame(role, {
    squash: 0, lift: 0, blink: false, eyesDx: 0, legs: 'stand',
    armL: 'up0', armR: 'up0', lamp: 'on', speedLines: 0, stars: false,
  })
  const fin1 = drawFrame(role, {
    squash: 0, lift: 2, blink: false, eyesDx: 0, legs: 'tucked',
    armL: 'up1', armR: 'up1', lamp: 'on', speedLines: 0, stars: false,
  })
  const fin2 = drawFrame(role, {
    squash: 0, lift: 0, blink: false, eyesDx: 0, legs: 'stand',
    armL: 'up0', armR: 'up0', lamp: 'on', speedLines: 0, stars: true,
  })
  return [
    idle0, idle1, runR0, runR1, runL0, runL1, wave0, wave1,
    jump0, jump1, timing0, timing1, fin0, fin1, fin2,
  ]
}

/* ============ 精灵图合成 ============ */

const FRAME_COUNT = 15

/** 网格帧数组 → 横排 spritesheet RGBA */
function composeSheet(frames, palette) {
  const W = GW * SCALE * FRAME_COUNT
  const H = GH * SCALE
  const rgba = Buffer.alloc(W * H * 4)
  for (let f = 0; f < frames.length; f++) {
    const grid = frames[f]
    const ox = f * GW * SCALE
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const [r, g, b, a] = palette[grid.get(gx, gy)]
        for (let sy = 0; sy < SCALE; sy++) {
          for (let sx = 0; sx < SCALE; sx++) {
            const px = ox + gx * SCALE + sx
            const py = gy * SCALE + sy
            const i = (py * W + px) * 4
            rgba[i] = r
            rgba[i + 1] = g
            rgba[i + 2] = b
            rgba[i + 3] = a
          }
        }
      }
    }
  }
  return { rgba, W, H }
}

/* ============ pet.json ============ */

function petManifest(id, name) {
  return {
    formatVersion: 2,
    spec: 'codex-custom-pet-v2',
    id,
    name,
    frame: { width: GW * SCALE, height: GH * SCALE },
    spritesheet: { file: 'spritesheet.png', layout: 'horizontal', frameCount: FRAME_COUNT },
    animations: {
      idle: { frames: [0, 1], fps: 2, loop: true },
      'running-right': { frames: [2, 3], fps: 8, loop: true },
      'running-left': { frames: [4, 5], fps: 8, loop: true },
      waving: { frames: [6, 7], fps: 4, loop: true },
      jumping: { frames: [8, 9], fps: 5, loop: false },
      timing: { frames: [10, 11], fps: 2, loop: true },
      finishing: { frames: [12, 13, 14], fps: 5, loop: false },
    },
  }
}

/* ============ 主流程 ============ */

const ROLES = [
  { id: 'bubcat', name: 'Codex' },
  { id: 'sprite', name: 'Terminal' },
  { id: 'bean', name: 'Pixel' },
]

for (const role of ROLES) {
  const palette = makePalette(role.id)
  const frames = buildFrames(role.id)
  const { rgba, W, H } = composeSheet(frames, palette)
  const dir = join(ASSETS_DIR, role.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'spritesheet.png'), encodePng(W, H, rgba))
  writeFileSync(join(dir, 'pet.json'), JSON.stringify(petManifest(role.id, role.name), null, 2) + '\n')
  console.log(`generated ${role.id}: ${W}x${H} (${FRAME_COUNT} frames)`)
}
console.log('done.')
