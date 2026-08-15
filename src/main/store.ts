/**
 * 数据存储层：JSON 本地读写 + 「临时文件 + rename」原子写。
 * 数据权威源在主进程，所有写操作收敛于此，保证单写者。
 */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CONFIG, DEFAULT_DATA } from '../shared/defaults'
import type { AppConfig, FullData } from '../shared/types'

const CONFIG_DEBOUNCE_MS = 200

/** 原子写：先写同目录 .tmp，再 rename 覆盖，避免写一半崩溃损坏文件 */
function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp'
  writeFileSync(tmp, content, 'utf-8')
  renameSync(tmp, filePath)
}

class Store {
  private readonly dir: string
  private readonly dataPath: string
  private readonly configPath: string
  private data: FullData
  private config: AppConfig
  private configTimer: NodeJS.Timeout | null = null
  private dataListeners: Set<() => void> = new Set()

  constructor() {
    // 数据路径：%APPDATA%\fantacy-todo-list-react\fantacy-todo-list
    this.dir = join(app.getPath('appData'), 'fantacy-todo-list-react', 'fantacy-todo-list')
    this.dataPath = join(this.dir, 'data.json')
    this.configPath = join(this.dir, 'config.json')
    this.data = this.clone(DEFAULT_DATA)
    this.config = { ...DEFAULT_CONFIG, petPosition: { ...DEFAULT_CONFIG.petPosition } }
  }

  /** 初始化：确保目录与文件存在，读取快照到内存 */
  init(): void {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
    this.data = this.readJson<FullData>(this.dataPath, DEFAULT_DATA)
    this.config = this.readJson<AppConfig>(this.configPath, DEFAULT_CONFIG)
    if (!existsSync(this.dataPath)) this.writeData()
    if (!existsSync(this.configPath)) this.writeConfig()
  }

  getData(): FullData {
    return this.clone(this.data)
  }

  getConfig(): AppConfig {
    return this.clone(this.config)
  }

  setData(data: FullData): void {
    this.data = this.clone(data)
    this.writeData()
    // 数据变更通知（气泡提醒等订阅方自行防抖）；store 不感知具体消费方
    this.dataListeners.forEach((cb) => cb())
  }

  /** 订阅数据变更，返回取消订阅函数 */
  onDataChanged(cb: () => void): () => void {
    this.dataListeners.add(cb)
    return () => {
      this.dataListeners.delete(cb)
    }
  }

  /** 写配置；debounce 用于桌宠拖拽/缩放等高频写入 */
  setConfig(patch: Partial<AppConfig>, opts?: { debounce?: boolean }): AppConfig {
    this.config = { ...this.config, ...patch }
    if (patch.petPosition) {
      this.config.petPosition = { ...this.config.petPosition, ...patch.petPosition }
    }
    if (opts?.debounce) {
      this.scheduleConfigWrite()
    } else {
      this.writeConfig()
    }
    return this.clone(this.config)
  }

  /** 应用退出前把防抖中的 config 落盘 */
  flushConfig(): void {
    if (this.configTimer) {
      clearTimeout(this.configTimer)
      this.configTimer = null
    }
    this.writeConfig()
  }

  private readJson<T>(filePath: string, fallback: T): T {
    if (!existsSync(filePath)) return this.clone(fallback)
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as T
    } catch (err) {
      console.error('[store] 读取 JSON 失败，回退默认值：', filePath, err)
      return this.clone(fallback)
    }
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }

  private writeData(): void {
    atomicWrite(this.dataPath, JSON.stringify(this.data, null, 2))
  }

  private scheduleConfigWrite(): void {
    if (this.configTimer) clearTimeout(this.configTimer)
    this.configTimer = setTimeout(() => {
      this.configTimer = null
      this.writeConfig()
    }, CONFIG_DEBOUNCE_MS)
  }

  private writeConfig(): void {
    atomicWrite(this.configPath, JSON.stringify(this.config, null, 2))
  }
}

export const store = new Store()
