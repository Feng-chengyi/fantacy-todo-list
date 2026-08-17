import { describe, expect, it } from 'vitest'
import { buildTaskRepository, listDateLabel } from './listView'
import type { Task } from './types'

const TODAY = '2026-08-17'

let seq = 0

function task(patch: Partial<Task>): Task {
  seq++
  return {
    id: patch.id ?? `t${seq}`,
    title: patch.title ?? `任务${seq}`,
    priority: 'medium',
    date: '2026-08-17',
    status: 'pending',
    createdAt: patch.createdAt ?? `2026-01-01T00:00:${String(seq).padStart(2, '0')}.000Z`,
    updatedAt: '',
    repeat: null,
    tags: [],
    ...patch,
  } as Task
}

describe('listDateLabel', () => {
  it('格式化为「M月d日 周X」', () => {
    expect(listDateLabel('2026-08-17')).toBe('8月17日 周一')
    expect(listDateLabel('2026-01-01')).toBe('1月1日 周四')
  })

  it('非法格式原样返回', () => {
    expect(listDateLabel('2026-13-99')).toBe('2026-13-99')
    expect(listDateLabel('abc')).toBe('abc')
  })
})

describe('buildTaskRepository 任务仓库', () => {
  it('每个任务仅一行：周期任务不按日期展开', () => {
    const habit = task({
      id: 'h1',
      title: '每日阅读',
      date: '2026-08-01',
      repeat: { type: 'daily', interval: 1 },
    })
    const repo = buildTaskRepository([habit], 'all')
    expect(repo).toHaveLength(1)
    expect(repo[0].id).toBe('h1')
  })

  it('收集箱任务（date=null）不在仓库中', () => {
    const inbox = task({ id: 'i1', date: null })
    const dated = task({ id: 'd1', date: TODAY })
    const repo = buildTaskRepository([inbox, dated], 'all')
    expect(repo.map((t) => t.id)).toEqual(['d1'])
  })

  it('筛选：all 全量，指定状态仅保留匹配项', () => {
    const tasks = [
      task({ id: 'p1', status: 'pending' }),
      task({ id: 'd1', status: 'done' }),
      task({ id: 'a1', status: 'abandoned' }),
    ]
    expect(buildTaskRepository(tasks, 'all')).toHaveLength(3)
    expect(buildTaskRepository(tasks, 'pending').map((t) => t.id)).toEqual(['p1'])
    expect(buildTaskRepository(tasks, 'done').map((t) => t.id)).toEqual(['d1'])
    expect(buildTaskRepository(tasks, 'abandoned').map((t) => t.id)).toEqual(['a1'])
  })

  it('排序：pending → done → abandoned；同状态按日期升序', () => {
    const tasks = [
      task({ id: 'done', status: 'done', date: '2026-08-01' }),
      task({ id: 'future', date: '2026-09-01' }),
      task({ id: 'past', date: '2026-08-10' }),
      task({ id: 'abandoned', status: 'abandoned', date: '2026-08-05' }),
    ]
    expect(buildTaskRepository(tasks, 'all').map((t) => t.id)).toEqual([
      'past',
      'future',
      'done',
      'abandoned',
    ])
  })

  it('同日排序：有开始时间在前并按时间升序，再按优先级', () => {
    const tasks = [
      task({ id: 'low', priority: 'low', date: TODAY }),
      task({ id: 't10', startTime: '10:00', date: TODAY }),
      task({ id: 't09', startTime: '09:00', date: TODAY }),
      task({ id: 'high-no-time', priority: 'high', date: TODAY }),
    ]
    expect(buildTaskRepository(tasks, 'all').map((t) => t.id)).toEqual([
      't09',
      't10',
      'high-no-time',
      'low',
    ])
  })

  it('不生成任何未来日期占位：任务数恒等于任务条目数', () => {
    const tasks = [
      task({ id: 'h1', repeat: { type: 'daily', interval: 1 }, date: '2026-08-01' }),
      task({ id: 'h2', repeat: { type: 'weekly', interval: 1 }, date: '2026-08-02' }),
      task({ id: 'n1', date: '2026-12-31' }),
    ]
    expect(buildTaskRepository(tasks, 'all')).toHaveLength(3)
  })
})
