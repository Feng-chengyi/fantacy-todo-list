// 拉取 Live2D 专有资源（Cubism Core + 6 个官方示例模型）
// 版权归 Live2D Inc.，非 MIT，不随仓库分发。
// 用法：npm run fetch:assets
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', 'src', 'pet', 'public', 'live2d')

const CORE_URL = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
const MODELS_BASE = 'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources'

// 补零：String(n).padStart(2,'0')，避免 seq -w 只补到最大数宽度的坑
const p = (n) => String(n).padStart(2, '0')

// 各模型的相对文件清单（源目录名 + 文件列表）
const MODELS = {
  haru: {
    dir: 'Haru',
    files: [
      'Haru.model3.json', 'Haru.moc3', 'Haru.physics3.json', 'Haru.pose3.json',
      'Haru.cdi3.json', 'Haru.userdata3.json',
      'Haru.2048/texture_00.png', 'Haru.2048/texture_01.png',
      ...Array.from({ length: 8 }, (_, i) => `expressions/F${p(i + 1)}.exp3.json`),
      'motions/haru_g_idle.motion3.json',
      ...Array.from({ length: 26 }, (_, i) => `motions/haru_g_m${p(i + 1)}.motion3.json`),
      'sounds/haru_Info_04.wav', 'sounds/haru_Info_14.wav',
      'sounds/haru_normal_6.wav', 'sounds/haru_talk_13.wav',
    ],
  },
  hiyori: {
    dir: 'Hiyori',
    files: [
      'Hiyori.model3.json', 'Hiyori.moc3', 'Hiyori.physics3.json', 'Hiyori.pose3.json',
      'Hiyori.cdi3.json', 'Hiyori.userdata3.json',
      'Hiyori.2048/texture_00.png', 'Hiyori.2048/texture_01.png',
      ...Array.from({ length: 10 }, (_, i) => `motions/Hiyori_m${p(i + 1)}.motion3.json`),
    ],
  },
  natori: {
    dir: 'Natori',
    files: [
      'Natori.model3.json', 'Natori.moc3', 'Natori.physics3.json', 'Natori.pose3.json',
      'Natori.cdi3.json', 'Natori.2048/texture_00.png',
      'exp/Angry.exp3.json', 'exp/Blushing.exp3.json',
      ...Array.from({ length: 5 }, (_, i) => `exp/exp_${p(i + 1)}.exp3.json`),
      'exp/Normal.exp3.json', 'exp/Sad.exp3.json', 'exp/Smile.exp3.json', 'exp/Surprised.exp3.json',
      ...Array.from({ length: 8 }, (_, i) => `motions/mtn_${p(i)}.motion3.json`),
    ],
  },
  mao: {
    dir: 'Mao',
    files: [
      'Mao.model3.json', 'Mao.moc3', 'Mao.physics3.json', 'Mao.pose3.json',
      'Mao.cdi3.json', 'Mao.2048/texture_00.png',
      ...Array.from({ length: 8 }, (_, i) => `expressions/exp_${p(i + 1)}.exp3.json`),
      ...Array.from({ length: 4 }, (_, i) => `motions/mtn_${p(i + 1)}.motion3.json`),
      'motions/sample_01.motion3.json',
      ...Array.from({ length: 3 }, (_, i) => `motions/special_${p(i + 1)}.motion3.json`),
    ],
  },
  wanko: {
    dir: 'Wanko',
    files: [
      'Wanko.model3.json', 'Wanko.moc3', 'Wanko.physics3.json', 'Wanko.cdi3.json',
      'Wanko.1024/texture_00.png',
      ...Array.from({ length: 4 }, (_, i) => `motions/idle_${p(i + 1)}.motion3.json`),
      ...Array.from({ length: 2 }, (_, i) => `motions/shake_${p(i + 1)}.motion3.json`),
      ...Array.from({ length: 6 }, (_, i) => `motions/touch_${p(i + 1)}.motion3.json`),
    ],
  },
  rice: {
    dir: 'Rice',
    files: [
      'Rice.model3.json', 'Rice.moc3', 'Rice.physics3.json', 'Rice.cdi3.json',
      'Rice.2048/texture_00.png', 'Rice.2048/texture_01.png',
      'motions/idle.motion3.json',
      ...Array.from({ length: 3 }, (_, i) => `motions/mtn_${p(i + 1)}.motion3.json`),
    ],
  },
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  // 校验是否为 jsdelivr 的 404 占位文本
  const head = buf.toString('utf8', 0, 200)
  if (head.includes("Couldn't find")) {
    throw new Error(`资源不存在（404 占位）: ${url}`)
  }
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, buf)
}

async function main() {
  console.log('→ 拉取 Cubism Core ...')
  await download(CORE_URL, resolve(ROOT, 'live2dcubismcore.min.js'))

  for (const [key, model] of Object.entries(MODELS)) {
    console.log(`→ 拉取模型 ${key} (${model.dir}) ...`)
    for (const f of model.files) {
      await download(`${MODELS_BASE}/${model.dir}/${f}`, resolve(ROOT, 'models', key, f))
    }
  }

  console.log('✅ Live2D 资源拉取完成（Cubism Core + 6 模型）')
  console.log('   版权归 Live2D Inc.，仅供本地运行使用，详见 THIRD_PARTY_NOTICES.md')
}

main().catch((err) => {
  console.error('❌ 拉取失败:', err.message)
  process.exit(1)
})
