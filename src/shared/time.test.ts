/**
 * time 纯函数单测：HH:mm 解析 / hh:mm:ss 秒表 / 用时分钟 / 仪表盘时长格式化。
 */
import { describe, expect, it } from 'vitest'
import {
  formatDurationAxis,
  formatDurationCompact,
  formatDurationMinutes,
  formatHms,
  isNightHour,
  timeToMinutes,
} from './time'

describe('timeToMinutes', () => {
  it('解析 HH:mm', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('09:30')).toBe(570)
    expect(timeToMinutes('23:59')).toBe(1439)
  })
  it('非法输入回退 0', () => {
    expect(timeToMinutes('')).toBe(0)
    expect(timeToMinutes('abc')).toBe(0)
    expect(timeToMinutes('9:3')).toBe(0)
  })
})

describe('formatHms', () => {
  it('hh:mm:ss', () => {
    expect(formatHms(0)).toBe('00:00:00')
    expect(formatHms(65)).toBe('00:01:05')
    expect(formatHms(3661)).toBe('01:01:01')
  })
  it('负数钳制为 0', () => {
    expect(formatHms(-5)).toBe('00:00:00')
  })
})

describe('formatDurationMinutes', () => {
  it('四舍五入', () => {
    expect(formatDurationMinutes(30)).toBe('1 分钟')
    expect(formatDurationMinutes(90)).toBe('2 分钟')
    expect(formatDurationMinutes(0)).toBe('0 分钟')
  })
})

describe('formatDurationCompact（仪表盘卡片/图例）', () => {
  it('不足 1 小时 → X 分钟', () => {
    expect(formatDurationCompact(0)).toBe('0 分钟')
    expect(formatDurationCompact(30 * 60)).toBe('30 分钟')
    expect(formatDurationCompact(59 * 60 + 29)).toBe('59 分钟')
  })
  it('59.5 分钟四舍五入进位到整小时', () => {
    expect(formatDurationCompact(59 * 60 + 30)).toBe('1 小时')
  })
  it('整小时 → X 小时', () => {
    expect(formatDurationCompact(3600)).toBe('1 小时')
    expect(formatDurationCompact(2 * 3600)).toBe('2 小时')
  })
  it('混合 → X 小时 Y 分', () => {
    expect(formatDurationCompact(75 * 60)).toBe('1 小时 15 分')
    expect(formatDurationCompact(25 * 3600 + 40 * 60)).toBe('25 小时 40 分')
  })
})

describe('formatDurationAxis（图表 y 轴刻度）', () => {
  it('分钟级 → Xm', () => {
    expect(formatDurationAxis(0)).toBe('0m')
    expect(formatDurationAxis(45 * 60)).toBe('45m')
  })
  it('小时级 → Xh / X.Xh', () => {
    expect(formatDurationAxis(3600)).toBe('1h')
    expect(formatDurationAxis(5400)).toBe('1.5h')
    expect(formatDurationAxis(7200)).toBe('2h')
  })
})

describe('isNightHour（日落自动切深色，P2-2）', () => {
  it('默认 18–6 跨零点区间：傍晚/凌晨为夜间，白天为日间', () => {
    expect(isNightHour(18)).toBe(true)
    expect(isNightHour(23)).toBe(true)
    expect(isNightHour(0)).toBe(true)
    expect(isNightHour(5)).toBe(true)
    expect(isNightHour(6)).toBe(false)
    expect(isNightHour(12)).toBe(false)
    expect(isNightHour(17)).toBe(false)
  })
  it('同日起区间（如 8–18）', () => {
    expect(isNightHour(8, 8, 18)).toBe(true)
    expect(isNightHour(17, 8, 18)).toBe(true)
    expect(isNightHour(18, 8, 18)).toBe(false)
    expect(isNightHour(7, 8, 18)).toBe(false)
  })
  it('from === to 视为全天夜间', () => {
    expect(isNightHour(3, 9, 9)).toBe(true)
    expect(isNightHour(15, 9, 9)).toBe(true)
  })
  it('非法小时回退 false', () => {
    expect(isNightHour(-1)).toBe(false)
    expect(isNightHour(24)).toBe(false)
    expect(isNightHour(Number.NaN)).toBe(false)
  })
})
