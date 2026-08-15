/**
 * 时间纯函数工具：HH:mm 解析、秒表格式化、用时展示。
 * main / renderer / pet 共用，禁止散落格式化逻辑。
 */

/** HH:mm → 当日分钟数；非法输入回退 0（避免 NaN 传播） */
export function timeToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim())
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

/** 秒 → hh:mm:ss（秒表进行中展示） */
export function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

/** 秒 → 「X 分钟」（四舍五入，用于已完成任务用时展示） */
export function formatDurationMinutes(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60))
  return `${minutes} 分钟`
}
