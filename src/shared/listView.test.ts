/**
 * 列表视图分组纯函数单测：收集箱/日期分组、重复展开上限、筛选联动、排序。
 */
import { describe, expect, it } from 'vitest'
import type { RepeatOverride, Task } from './types'
import { buildListGroups, buildTodoGroups, listDateLabel } from './listView'

const TODAY = '2026-08-16'

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: '任务',
    priority: 'medium',
    date: null,
    status: 'pending',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    tags: [],
    ...over,
  }
}

describe('listDateLabel', () => {
  it('YYYY-MM-DD → M月d日 周X', () => {
    expect(listDateLabel('2026-08-16')).toBe('8月16日 周日')
    expect(listDateLabel('2026-08-17')).toBe('8月17日 周一')
  })
  it('非法输入原样返回', () => {
    expect(listDateLabel('inbox')).toBe('inbox')
    expect(listDateLabel('2026-13-99')).toBe('2026-13-99')
  })
})

describe('buildListGroups 分组结构', () => {
  it('收集箱在最前，日期组升序，今日组标记 isToday', () => {
    const tasks = [
      task({ id: 'inbox1', date: null }),
      task({ id: 'd2', date: '2026-08-17' }),
      task({ id: 'd1', date: '2026-08-16' }),
      task({ id: 'd0', date: '2026-08-15' }),
    ]
    const groups = buildListGroups(tasks, [], 'all', TODAY)
    expect(groups.map((g) => g.key)).toEqual(['inbox', '2026-08-15', '2026-08-16', '2026-08-17'])
    expect(groups[0].label).toBe('收集箱')
    expect(groups.find((g) => g.key === '2026-08-16')?.isToday).toBe(true)
    expect(groups.find((g) => g.key === '2026-08-15')?.isToday).toBe(false)
  })

  it('无收集箱任务时不产生收集箱组', () => {
    const groups = buildListGroups([task({ id: 'd1', date: TODAY })], [], 'all', TODAY)
    expect(groups.map((g) => g.key)).toEqual(['2026-08-16'])
  })

  it('筛选联动：pending 只留未完成', () => {
    const tasks = [
      task({ id: 'p1', date: TODAY, status: 'pending' }),
      task({ id: 'd1', date: TODAY, status: 'done' }),
    ]
    const groups = buildListGroups(tasks, [], 'pending', TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].occurrences.map((o) => o.task.id)).toEqual(['p1'])
  })

  it('abandoned 筛选：仅保留已放弃', () => {
    const tasks = [
      task({ id: 'a1', date: TODAY, status: 'abandoned' }),
      task({ id: 'p1', date: TODAY, status: 'pending' }),
    ]
    const groups = buildListGroups(tasks, [], 'abandoned', TODAY)
    expect(groups[0].occurrences.map((o) => o.task.id)).toEqual(['a1'])
  })
})

describe('buildListGroups 重复任务展开', () => {
  it('按日期逐日展开为多组实例', () => {
    const tasks = [
      task({ id: 'r1', date: '2026-08-16', repeat: { type: 'daily', interval: 1 } }),
    ]
    const groups = buildListGroups(tasks, [], 'all', TODAY, 3)
    // 展开 [anchor=8/16, today+3=8/19]
    expect(groups.map((g) => g.key)).toEqual(['2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19'])
    expect(groups.every((g) => g.occurrences[0].task.id === 'r1')).toBe(true)
  })

  it('horizonDays 上限防止无限重复撑爆列表', () => {
    const tasks = [
      task({ id: 'r1', date: '2026-08-16', repeat: { type: 'daily', interval: 1 } }),
    ]
    const groups = buildListGroups(tasks, [], 'all', TODAY, 30)
    expect(groups).toHaveLength(31) // 8/16 ~ 9/15
  })

  it('endDate 边界生效：超过 endDate 不展开', () => {
    const tasks = [
      task({ id: 'r1', date: '2026-08-16', repeat: { type: 'daily', interval: 1, endDate: '2026-08-18' } }),
    ]
    const groups = buildListGroups(tasks, [], 'all', TODAY, 30)
    expect(groups.map((g) => g.key)).toEqual(['2026-08-16', '2026-08-17', '2026-08-18'])
  })

  it('skipped 实例隐藏；done 覆盖决定实例状态', () => {
    const tasks = [
      task({ id: 'r1', date: '2026-08-16', repeat: { type: 'daily', interval: 1 } }),
    ]
    const overrides: RepeatOverride[] = [
      { id: 'o1', taskId: 'r1', occurrenceDate: '2026-08-17', action: 'skipped' },
      { id: 'o2', taskId: 'r1', occurrenceDate: '2026-08-16', action: 'done' },
    ]
    const groups = buildListGroups(tasks, overrides, 'all', TODAY, 2)
    expect(groups.map((g) => g.key)).toEqual(['2026-08-16', '2026-08-18'])
    expect(groups[0].occurrences[0].status).toBe('done')
  })

  it('done 筛选时仅保留 done 实例', () => {
    const tasks = [
      task({ id: 'r1', date: '2026-08-16', repeat: { type: 'daily', interval: 1 } }),
    ]
    const overrides: RepeatOverride[] = [
      { id: 'o1', taskId: 'r1', occurrenceDate: '2026-08-16', action: 'done' },
    ]
    const groups = buildListGroups(tasks, overrides, 'done', TODAY, 2)
    expect(groups.map((g) => g.key)).toEqual(['2026-08-16'])
  })
})

describe('buildListGroups 组内排序', () => {
  it('有时间在前按开始时间升序，其余按优先级', () => {
    const tasks = [
      task({ id: 'low', date: TODAY, priority: 'low' }),
      task({ id: 'high', date: TODAY, priority: 'high' }),
      task({ id: 't1400', date: TODAY, startTime: '14:00' }),
      task({ id: 't0900', date: TODAY, startTime: '09:00' }),
    ]
    const groups = buildListGroups(tasks, [], 'all', TODAY)
    expect(groups[0].occurrences.map((o) => o.task.id)).toEqual(['t0900', 't1400', 'high', 'low'])
  })
})

describe('buildTodoGroups 待办首页分组', () => {
  it('不含收集箱；今日 + 未来升序；今日组标记 isToday', () => {
    const tasks = [
      task({ id: 'inbox1', date: null }),
      task({ id: 'future', date: '2026-08-20' }),
      task({ id: 'today', date: TODAY }),
    ]
    const groups = buildTodoGroups(tasks, [], 'all', TODAY)
    expect(groups.map((g) => g.key)).toEqual(['2026-08-16', '2026-08-20'])
    expect(groups[0].isToday).toBe(true)
  })

  it('逾期未完成任务归入置顶「已逾期」组', () => {
    const tasks = [
      task({ id: 'overdue', date: '2026-08-10', status: 'pending' }),
      task({ id: 'today', date: TODAY }),
    ]
    const groups = buildTodoGroups(tasks, [], 'all', TODAY)
    expect(groups.map((g) => g.key)).toEqual(['overdue', TODAY])
    expect(groups[0].label).toBe('已逾期')
    expect(groups[0].occurrences.map((o) => o.task.id)).toEqual(['overdue'])
  })

  it('逾期但已完成 / 已放弃的任务不进入已逾期组（历史归时间轴）', () => {
    const tasks = [
      task({ id: 'doneOld', date: '2026-08-10', status: 'done' }),
      task({ id: 'abandonOld', date: '2026-08-11', status: 'abandoned' }),
    ]
    expect(buildTodoGroups(tasks, [], 'all', TODAY)).toHaveLength(0)
  })

  it('重复任务自今日起展开（历史实例不进入待办首页）', () => {
    // anchor 在今日之前：8/14 起每日重复，待办首页只展开 8/16 起
    const tasks = [
      task({ id: 'r1', date: '2026-08-14', repeat: { type: 'daily', interval: 1 } }),
    ]
    const groups = buildTodoGroups(tasks, [], 'all', TODAY, 2)
    expect(groups.map((g) => g.key)).toEqual(['2026-08-16', '2026-08-17', '2026-08-18'])
  })

  it('重复任务 anchor 在未来：不早于 anchor 展开', () => {
    const tasks = [
      task({ id: 'r1', date: '2026-08-18', repeat: { type: 'daily', interval: 1 } }),
    ]
    const groups = buildTodoGroups(tasks, [], 'all', TODAY, 5)
    expect(groups.map((g) => g.key)).toEqual(['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'])
  })

  it('skipped 实例隐藏；筛选联动 pending 仅留未完成', () => {
    const tasks = [
      task({ id: 'r1', date: '2026-08-14', repeat: { type: 'daily', interval: 1 } }),
    ]
    const overrides: RepeatOverride[] = [
      { id: 'o1', taskId: 'r1', occurrenceDate: TODAY, action: 'skipped' },
      { id: 'o2', taskId: 'r1', occurrenceDate: '2026-08-17', action: 'done' },
    ]
    const all = buildTodoGroups(tasks, overrides, 'all', TODAY, 2)
    // 8/16 skipped 隐藏；8/17 done 覆盖在 all 筛选下保留
    expect(all.map((g) => g.key)).toEqual(['2026-08-17', '2026-08-18'])
    const pending = buildTodoGroups(tasks, overrides, 'pending', TODAY, 5)
    expect(pending.map((g) => g.key)).toEqual(['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'])
  })

  it('done 筛选：仅保留今日及未来的已完成实例', () => {
    const tasks = [
      task({ id: 'oldDone', date: '2026-08-10', status: 'done' }),
      task({ id: 'todayDone', date: TODAY, status: 'done' }),
      task({ id: 'todayPending', date: TODAY }),
    ]
    const groups = buildTodoGroups(tasks, [], 'done', TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].occurrences.map((o) => o.task.id)).toEqual(['todayDone'])
  })
})
