/**
 * time 纯函数单测：HH:mm 解析 / hh:mm:ss 秒表 / 用时分钟。
 */
import { describe, expect, it } from 'vitest'
import { formatDurationMinutes, formatHms, timeToMinutes } from './time'

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
