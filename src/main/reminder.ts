/**
 * 任务提醒调度器（主进程）：30 秒轮询 listDueReminders + 进程内去重 + 1 小时回溯补触发。
 * 投递两条通道（可同时）：
 * 1) 桌宠气泡 pet:bubble（复用现有通道，零 pet 改动）；
 * 2) config.reminderSystemNotification 为 true 时弹 Electron 系统通知，
 *    点击 → focusMain + openPanel('today')。
 * 每次 tick 末尾 prune 已完成/已删除/提醒被移除的 key，防止去重集合无界增长。
 */
import { Notification } from 'electron'
import { todayStr } from '../shared/date'
import { IPC_MAIN } from '../shared/ipc-channels'
import { listDueReminders, listTodayReminders, REMINDER_POLL_MS } from '../shared/reminder'
import type { FullData, MainPanel } from '../shared/types'
import { store } from './store'
import { getMainWindow, getPetWindow } from './windows'

let timer: NodeJS.Timeout | null = null
/** 已触发的提醒 key（taskId@日期），进程内去重 */
const fired = new Set<string>()

/** 聚焦主窗口并打开指定面板（系统通知点击唤回） */
function focusMainAndOpenPanel(panel: MainPanel): void {
  const win = getMainWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  win.webContents.send(IPC_MAIN.openPanel, panel)
}

/** 触发一条提醒：桌宠气泡 +（可选）系统通知 */
function deliverReminder(instance: { time: string; title: string }): void {
  const text = `⏰ ${instance.time} · ${instance.title}`
  getPetWindow()?.webContents.send(IPC_MAIN.petBubble, text)

  if (store.getConfig().reminderSystemNotification !== false) {
    try {
      const notification = new Notification({ title: '待办提醒', body: `${instance.time} · ${instance.title}` })
      notification.on('click', () => focusMainAndOpenPanel('today'))
      notification.show()
    } catch (err) {
      console.warn('[reminder] 系统通知投递失败：', err)
    }
  }
}

/** 清理去重集合：仅保留「今天仍 pending 且带提醒」的 key */
function pruneFired(data: FullData): void {
  const today = todayStr()
  const active = new Set(listTodayReminders(data, today).map((r) => r.key))
  for (const key of fired) {
    if (!active.has(key)) fired.delete(key)
  }
}

/** 单次轮询：触发新到点的提醒，随后 prune */
function tick(): void {
  const data = store.getData()
  for (const r of listDueReminders(data)) {
    if (fired.has(r.key)) continue
    fired.add(r.key)
    deliverReminder(r)
  }
  pruneFired(data)
}

/** 启动调度器：先执行一次 catch-up（应用晚启动补触发），再进入 30s 轮询 */
export function startReminderScheduler(): void {
  if (timer) return
  tick()
  timer = setInterval(tick, REMINDER_POLL_MS)
}

/** 停止调度器（应用退出前调用） */
export function stopReminderScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
