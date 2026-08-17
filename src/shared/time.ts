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

/** 秒 → 「X 小时 Y 分 / X 小时 / X 分钟」（统计仪表盘卡片与图例展示） */
export function formatDurationCompact(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m} 分钟`
  if (m === 0) return `${h} 小时`
  return `${h} 小时 ${m} 分`
}

/** 秒 → 紧凑轴刻度标签（如「45m」「1.5h」「2h」，图表 y 轴用） */
export function formatDurationAxis(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60))
  if (minutes < 60) return `${minutes}m`
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`
}

/**
 * 是否处于「夜间时段」（P2-2 日落自动切深色）：
 * 支持跨零点区间（from=18, to=6 → 18:00 次日 06:00 为夜间）。
 * from === to 视为全天夜间；非法输入回退 false。
 */
export function isNightHour(hour: number, from = 18, to = 6): boolean {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return false
  if (from === to) return true
  if (from < to) return hour >= from && hour < to
  return hour >= from || hour < to
}
