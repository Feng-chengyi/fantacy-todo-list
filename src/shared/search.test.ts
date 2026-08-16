/**
 * search 纯函数单测：子串 / 子序列模糊匹配 + 排序优先级。
 */
import { describe, expect, it } from 'vitest'
import type { Task } from './types'
import { matchesFuzzy, searchTasks } from './search'

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: '任务',
    priority: 'medium',
    date: null,
    status: 'pending',
    createdAt: '2025-08-15T00:00:00.000Z',
    updatedAt: '2025-08-15T00:00:00.000Z',
    tags: [],
    ...over,
  }
}

describe('matchesFuzzy', () => {
  it('子串命中（忽略大小写）', () => {
    expect(matchesFuzzy('背单词', '单词')).toBe(true)
    expect(matchesFuzzy('Meeting Notes', 'meeting')).toBe(true)
  })
  it('子序列命中', () => {
    expect(matchesFuzzy('背单词计划', '背计')).toBe(true)
  })
  it('不匹配返回 false', () => {
    expect(matchesFuzzy('阅读', '背单词')).toBe(false)
  })
  it('空查询返回 false', () => {
    expect(matchesFuzzy('阅读', '  ')).toBe(false)
  })
})

describe('searchTasks', () => {
  it('空查询返回空数组', () => {
    expect(searchTasks([task({ id: 't1', title: '背单词' })], '')).toEqual([])
  })

  it('标题前缀命中 > 标题子串 > 标题子序列 > 描述子串', () => {
    const tasks = [
      task({ id: 'sub', title: '我的背单词', description: '' }),
      task({ id: 'seq', title: '背诵单词本', description: '' }),
      task({ id: 'prefix', title: '背单词', description: '' }),
      task({ id: 'desc', title: '英语', description: '背单词计划' }),
    ]
    const ids = searchTasks(tasks, '背单词').map((r) => r.task.id)
    expect(ids).toEqual(['prefix', 'sub', 'seq', 'desc'])
  })

  it('标签命中排在标题子序列之前', () => {
    const tasks = [
      task({ id: 'seq', title: '背诵单词本', tags: [] }),
      task({ id: 'tag', title: '英语', tags: ['背单词'] }),
    ]
    const ids = searchTasks(tasks, '背单词').map((r) => r.task.id)
    expect(ids).toEqual(['tag', 'seq'])
  })

  it('按标签模糊检索可命中（忽略大小写）', () => {
    const tasks = [
      task({ id: 'other', title: '阅读', tags: [] }),
      task({ id: 'hit', title: '报告', tags: ['工作', 'MEETING'] }),
    ]
    const ids = searchTasks(tasks, 'meeting').map((r) => r.task.id)
    expect(ids).toEqual(['hit'])
  })

  it('同分按优先级（高→中→低）排序', () => {
    const tasks = [
      task({ id: 'low', title: '背单词', priority: 'low' }),
      task({ id: 'high', title: '背单词', priority: 'high' }),
      task({ id: 'medium', title: '背单词', priority: 'medium' }),
    ]
    const ids = searchTasks(tasks, '背单词').map((r) => r.task.id)
    expect(ids).toEqual(['high', 'medium', 'low'])
  })

  it('同分同优先级按日期升序、收集箱殿后', () => {
    const tasks = [
      task({ id: 'inbox', title: '背单词', date: null }),
      task({ id: 'future', title: '背单词', date: '2025-09-01' }),
      task({ id: 'past', title: '背单词', date: '2025-08-01' }),
    ]
    const ids = searchTasks(tasks, '背单词').map((r) => r.task.id)
    expect(ids).toEqual(['past', 'future', 'inbox'])
  })

  it('不修改入参数组', () => {
    const tasks = [task({ id: 'b', title: '阅读' }), task({ id: 'a', title: '背单词' })]
    searchTasks(tasks, '读')
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a'])
  })
})
