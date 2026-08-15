/**
 * repeatEngine 单测：覆盖 5 种类型 + 间隔 + endDate/endCount + override + 短月/闰年钳制。
 */
import { describe, expect, it } from 'vitest'
import type { RepeatOverride, RepeatRule, TaskStatus } from './types'
import {
  getOccurrenceStatus,
  isOccurrenceOnDate,
  listOccurrencesInRange,
  nthOccurrence,
} from './repeatEngine'

const pending: TaskStatus = 'pending'

describe('daily', () => {
  const rule: RepeatRule = { type: 'daily', interval: 1 }
  it('每天命中', () => {
    expect(isOccurrenceOnDate('2025-01-01', rule, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-02', rule, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-31', rule, '2025-01-01')).toBe(true)
  })
  it('不向前回溯', () => {
    expect(isOccurrenceOnDate('2024-12-31', rule, '2025-01-01')).toBe(false)
  })
  it('间隔 N 天', () => {
    const r: RepeatRule = { type: 'daily', interval: 3 }
    expect(isOccurrenceOnDate('2025-01-01', r, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-04', r, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-07', r, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-03', r, '2025-01-01')).toBe(false)
  })
})

describe('weekly', () => {
  it('指定星期命中', () => {
    // 2025-01-06 为周一
    const rule: RepeatRule = { type: 'weekly', interval: 1, weekdays: [1, 3] }
    expect(isOccurrenceOnDate('2025-01-06', rule, '2025-01-06')).toBe(true) // 周一
    expect(isOccurrenceOnDate('2025-01-08', rule, '2025-01-06')).toBe(true) // 周三
    expect(isOccurrenceOnDate('2025-01-13', rule, '2025-01-06')).toBe(true) // 下周一
    expect(isOccurrenceOnDate('2025-01-07', rule, '2025-01-06')).toBe(false) // 周二
  })
  it('weekdays 为空按创建日星期', () => {
    const rule: RepeatRule = { type: 'weekly', interval: 1 }
    // 2025-01-06 周一
    expect(isOccurrenceOnDate('2025-01-13', rule, '2025-01-06')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-14', rule, '2025-01-06')).toBe(false)
  })
})

describe('monthly', () => {
  it('monthDay=31 短月钳制', () => {
    const rule: RepeatRule = { type: 'monthly', interval: 1, monthDay: 31 }
    expect(isOccurrenceOnDate('2025-01-31', rule, '2025-01-31')).toBe(true)
    expect(isOccurrenceOnDate('2025-02-28', rule, '2025-01-31')).toBe(true) // 2 月钳到 28
    expect(isOccurrenceOnDate('2025-02-27', rule, '2025-01-31')).toBe(false)
    expect(isOccurrenceOnDate('2025-03-31', rule, '2025-01-31')).toBe(true)
    expect(isOccurrenceOnDate('2025-04-30', rule, '2025-01-31')).toBe(true) // 4 月钳到 30
  })
})

describe('yearly', () => {
  it('2/29 非闰年钳制到 2/28', () => {
    const rule: RepeatRule = { type: 'yearly', interval: 1, yearMonth: 2, yearDay: 29 }
    expect(isOccurrenceOnDate('2024-02-29', rule, '2024-02-29')).toBe(true)
    expect(isOccurrenceOnDate('2025-02-28', rule, '2024-02-29')).toBe(true) // 非闰年钳制
    expect(isOccurrenceOnDate('2025-02-27', rule, '2024-02-29')).toBe(false)
    expect(isOccurrenceOnDate('2026-02-28', rule, '2024-02-29')).toBe(true)
    expect(isOccurrenceOnDate('2028-02-29', rule, '2024-02-29')).toBe(true) // 闰年
  })
})

describe('custom', () => {
  it('每隔 N 天', () => {
    const rule: RepeatRule = { type: 'custom', interval: 3 }
    expect(isOccurrenceOnDate('2025-01-01', rule, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-04', rule, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-05', rule, '2025-01-01')).toBe(false)
  })
})

describe('endDate / endCount', () => {
  it('endDate 之后不命中', () => {
    const rule: RepeatRule = { type: 'daily', interval: 1, endDate: '2025-01-05' }
    expect(isOccurrenceOnDate('2025-01-05', rule, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-06', rule, '2025-01-01')).toBe(false)
  })
  it('endCount 次数上限', () => {
    const rule: RepeatRule = { type: 'daily', interval: 1, endCount: 3 }
    expect(isOccurrenceOnDate('2025-01-01', rule, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-03', rule, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-04', rule, '2025-01-01')).toBe(false)
  })
})

describe('override', () => {
  const overrides: RepeatOverride[] = [
    { id: 'o1', taskId: 't1', occurrenceDate: '2025-01-02', action: 'done' },
    { id: 'o2', taskId: 't1', occurrenceDate: '2025-01-03', action: 'skipped' },
  ]
  it('无覆盖返回基础状态', () => {
    expect(getOccurrenceStatus('t1', '2025-01-01', overrides, pending)).toBe('pending')
  })
  it('done 覆盖显示已完成', () => {
    expect(getOccurrenceStatus('t1', '2025-01-02', overrides, pending)).toBe('done')
  })
  it('skipped 覆盖彻底隐藏', () => {
    expect(getOccurrenceStatus('t1', '2025-01-03', overrides, pending)).toBe('skipped')
  })
})

describe('nthOccurrence', () => {
  it('计算第 N 次发生日期', () => {
    const rule: RepeatRule = { type: 'daily', interval: 1 }
    expect(nthOccurrence(rule, '2025-01-01', 1)).toBe('2025-01-01')
    expect(nthOccurrence(rule, '2025-01-01', 3)).toBe('2025-01-03')
  })
})

describe('listOccurrencesInRange', () => {
  it('展开区间内实例', () => {
    const rule: RepeatRule = { type: 'daily', interval: 1 }
    const list = listOccurrencesInRange(rule, '2025-01-01', '2025-01-01', '2025-01-05', [], pending, 't1')
    expect(list.map((e) => e.date)).toEqual([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
      '2025-01-04',
      '2025-01-05',
    ])
  })
})

// ===== QA 补充边界用例 =====

describe('interval 边界（<=0 / 非整数）', () => {
  it('custom interval<=0 归一为 1（等价每天）', () => {
    const r0: RepeatRule = { type: 'custom', interval: 0 }
    const rNeg: RepeatRule = { type: 'custom', interval: -5 }
    expect(isOccurrenceOnDate('2025-01-01', r0, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-02', r0, '2025-01-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-01-02', rNeg, '2025-01-01')).toBe(true)
  })
  it('interval 非整数向下取整', () => {
    const r: RepeatRule = { type: 'daily', interval: 2.9 }
    expect(isOccurrenceOnDate('2025-01-03', r, '2025-01-01')).toBe(true) // diff 2 % 2 === 0
    expect(isOccurrenceOnDate('2025-01-04', r, '2025-01-01')).toBe(false) // diff 3 % 2 === 1
  })
})

describe('weekly 进阶', () => {
  it('多 weekday + interval=2（隔周命中指定星期）', () => {
    // 2025-01-06 为周一
    const rule: RepeatRule = { type: 'weekly', interval: 2, weekdays: [1, 3] }
    expect(isOccurrenceOnDate('2025-01-06', rule, '2025-01-06')).toBe(true) // 第 0 周周一
    expect(isOccurrenceOnDate('2025-01-08', rule, '2025-01-06')).toBe(true) // 第 0 周周三
    expect(isOccurrenceOnDate('2025-01-13', rule, '2025-01-06')).toBe(false) // 第 1 周（隔周）
    expect(isOccurrenceOnDate('2025-01-20', rule, '2025-01-06')).toBe(true) // 第 2 周周一
    expect(isOccurrenceOnDate('2025-01-22', rule, '2025-01-06')).toBe(true) // 第 2 周周三
  })
  it('anchor 自身星期不在 weekdays 时 anchor 不命中（语义边界）', () => {
    // anchor 为周三 2025-01-08，weekdays=[1] 仅周一
    const rule: RepeatRule = { type: 'weekly', interval: 1, weekdays: [1] }
    expect(isOccurrenceOnDate('2025-01-08', rule, '2025-01-08')).toBe(false)
    expect(isOccurrenceOnDate('2025-01-13', rule, '2025-01-08')).toBe(true)
  })
})

describe('monthly 进阶', () => {
  it('monthDay=31 短月钳制 + interval=2 全年正确', () => {
    const rule: RepeatRule = { type: 'monthly', interval: 2, monthDay: 31 }
    expect(isOccurrenceOnDate('2025-01-31', rule, '2025-01-31')).toBe(true)
    expect(isOccurrenceOnDate('2025-02-28', rule, '2025-01-31')).toBe(false) // 2 月不是隔月
    expect(isOccurrenceOnDate('2025-03-31', rule, '2025-01-31')).toBe(true)
    expect(isOccurrenceOnDate('2025-04-30', rule, '2025-01-31')).toBe(false)
    expect(isOccurrenceOnDate('2025-05-31', rule, '2025-01-31')).toBe(true)
    expect(isOccurrenceOnDate('2025-09-30', rule, '2025-01-31')).toBe(true) // 9 月钳到 30
    expect(isOccurrenceOnDate('2025-11-30', rule, '2025-01-31')).toBe(true) // 11 月钳到 30
    expect(isOccurrenceOnDate('2025-10-31', rule, '2025-01-31')).toBe(false)
  })
  it('anchor 非 monthDay 时以 monthDay 为基准（语义边界）', () => {
    const rule: RepeatRule = { type: 'monthly', interval: 1, monthDay: 15 }
    expect(isOccurrenceOnDate('2025-02-15', rule, '2025-02-01')).toBe(true)
    expect(isOccurrenceOnDate('2025-02-01', rule, '2025-02-01')).toBe(false) // anchor 自身不是 15 号
  })
})

describe('yearly 进阶', () => {
  it('2/29 平年钳制 + interval=2', () => {
    const rule: RepeatRule = { type: 'yearly', interval: 2, yearMonth: 2, yearDay: 29 }
    expect(isOccurrenceOnDate('2024-02-29', rule, '2024-02-29')).toBe(true) // 第 0 年
    expect(isOccurrenceOnDate('2025-02-28', rule, '2024-02-29')).toBe(false) // 第 1 年（隔年）
    expect(isOccurrenceOnDate('2026-02-28', rule, '2024-02-29')).toBe(true) // 第 2 年钳到 28
    expect(isOccurrenceOnDate('2028-02-29', rule, '2024-02-29')).toBe(true) // 第 4 年闰年
  })
  it('平年 anchor(2/28) 下 yearDay=29 在闰年命中 2/29', () => {
    const rule: RepeatRule = { type: 'yearly', interval: 1, yearMonth: 2, yearDay: 29 }
    expect(isOccurrenceOnDate('2023-02-28', rule, '2023-02-28')).toBe(true) // 平年钳到 28
    expect(isOccurrenceOnDate('2024-02-29', rule, '2023-02-28')).toBe(true) // 闰年 29
  })
})

describe('endCount 精确边界（非 daily）', () => {
  it('weekly interval=1 的 endCount 精确边界', () => {
    const rule: RepeatRule = { type: 'weekly', interval: 1, weekdays: [1], endCount: 3 }
    expect(isOccurrenceOnDate('2025-01-06', rule, '2025-01-06')).toBe(true) // 第 1 次
    expect(isOccurrenceOnDate('2025-01-20', rule, '2025-01-06')).toBe(true) // 第 3 次
    expect(isOccurrenceOnDate('2025-01-27', rule, '2025-01-06')).toBe(false) // 第 4 次超出
  })
  it('monthly 短月钳制下的 endCount 精确边界', () => {
    const rule: RepeatRule = { type: 'monthly', interval: 1, monthDay: 31, endCount: 2 }
    expect(isOccurrenceOnDate('2025-01-31', rule, '2025-01-31')).toBe(true) // 第 1 次
    expect(isOccurrenceOnDate('2025-02-28', rule, '2025-01-31')).toBe(true) // 第 2 次（钳制）
    expect(isOccurrenceOnDate('2025-03-31', rule, '2025-01-31')).toBe(false) // 第 3 次超出
  })
})

describe('override 同日期优先级', () => {
  it('同日期多条覆盖按数组顺序首个匹配生效（数据层 upsert 保证唯一）', () => {
    const overrides: RepeatOverride[] = [
      { id: 'o1', taskId: 't1', occurrenceDate: '2025-01-02', action: 'done' },
      { id: 'o2', taskId: 't1', occurrenceDate: '2025-01-02', action: 'skipped' },
    ]
    expect(getOccurrenceStatus('t1', '2025-01-02', overrides, pending)).toBe('done')
  })
})

describe('nthOccurrence 进阶', () => {
  it('monthly 钳制下计算第 N 次', () => {
    const rule: RepeatRule = { type: 'monthly', interval: 1, monthDay: 31 }
    expect(nthOccurrence(rule, '2025-01-31', 2)).toBe('2025-02-28')
    expect(nthOccurrence(rule, '2025-01-31', 3)).toBe('2025-03-31')
  })
  it('yearly 平年钳制下计算第 N 次', () => {
    const rule: RepeatRule = { type: 'yearly', interval: 1, yearMonth: 2, yearDay: 29 }
    expect(nthOccurrence(rule, '2024-02-29', 2)).toBe('2025-02-28')
  })
  it('n<1 返回 null', () => {
    const rule: RepeatRule = { type: 'daily', interval: 1 }
    expect(nthOccurrence(rule, '2025-01-01', 0)).toBeNull()
    expect(nthOccurrence(rule, '2025-01-01', -1)).toBeNull()
  })
})

describe('listOccurrencesInRange 覆盖状态', () => {
  it('区间展开保留 skipped 状态，由调用方过滤', () => {
    const rule: RepeatRule = { type: 'daily', interval: 1 }
    const overrides: RepeatOverride[] = [
      { id: 'o1', taskId: 't1', occurrenceDate: '2025-01-03', action: 'skipped' },
    ]
    const list = listOccurrencesInRange(rule, '2025-01-01', '2025-01-01', '2025-01-04', overrides, pending, 't1')
    expect(list.find((e) => e.date === '2025-01-03')?.status).toBe('skipped')
    expect(list.filter((e) => e.status !== 'skipped').map((e) => e.date)).toEqual([
      '2025-01-01',
      '2025-01-02',
      '2025-01-04',
    ])
  })
})
