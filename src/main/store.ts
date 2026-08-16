/**
 * 数据存储层：JSON 本地读写 + 「临时文件 + rename」原子写。
 * 数据权威源在主进程，所有写操作收敛于此，保证单写者。
 */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_DATA, mergeConfig } from '../shared/defaults'
import { normalizeHabit } from '../shared/habit'
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
    this.config = mergeConfig({})
  }

  /** 初始化：确保目录与文件存在，读取快照到内存 */
  init(): void {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
    this.data = this.normalizeData(this.readJson<FullData>(this.dataPath, DEFAULT_DATA))
    // mergeConfig（shared/defaults）统一处理：默认值兜底、petPosition 逐字段合并、
    // 旧字段 selectedModel → selectedCharacter 迁移（QA O8）
    this.config = mergeConfig(this.readJson<unknown>(this.configPath, {}))
    if (!existsSync(this.dataPath)) this.writeData()
    if (!existsSync(this.configPath)) this.writeConfig()
  }

  getData(): FullData {
    return this.clone(this.data)
  }

  /** 资产落盘目录（背景图/BGM 等用户定制文件），调用方负责 mkdir */
  get assetsDir(): string {
    return join(this.dir, 'assets')
  }

  getConfig(): AppConfig {
    return this.clone(this.config)
  }

  setData(data: FullData): void {
    this.data = this.normalizeData(data)
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

  /**
   * 数据迁移：为旧任务补全 category / color 字段（缺省为空字符串），
   * 为旧数据补全 goals / habits 数组，为 habit 补全 archived、为 goal 补全 category/color，
   * 使渲染进程 / 统计 / 校验层无需再判断 undefined。
   */
  private normalizeData(data: FullData): FullData {
    const tasks = Array.isArray(data.tasks) ? data.tasks : []
    const goals = Array.isArray(data.goals) ? data.goals : []
    const habits = Array.isArray(data.habits) ? data.habits : []
    return {
      ...data,
      tasks: tasks.map((t) => ({
        ...t,
        category: typeof t.category === 'string' ? t.category : '',
        color: typeof t.color === 'string' ? t.color : '',
      })),
      overrides: Array.isArray(data.overrides) ? data.overrides : [],
      goals: goals.map((g) => ({
        ...g,
        category: typeof g.category === 'string' ? g.category : '',
        color: typeof g.color === 'string' ? g.color : '',
      })),
      habits: habits.map((h) => normalizeHabit(h)),
      // 专注会话记录：旧 data.json 缺省回填空数组
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
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
