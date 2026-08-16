/**
 * 任务搜索纯函数：子串（忽略大小写）+ 子序列模糊匹配。
 * 匹配范围：标题、标签、描述。
 * 排序优先级：标题前缀命中 > 标题子串命中 > 标签命中 > 标题子序列 > 描述子串 > 描述子序列；
 * 同分再按优先级（高→低）、日期（升序、收集箱殿后）、标题（中文 locale）稳定排序。
 */
import { PRIORITY_ORDER } from './defaults'
import type { SearchResult, Task } from './types'

/** 打分分段基值（避免不同匹配类别得分区间重叠，保证优先级稳定） */
const SCORE_TITLE_SUBSTR = 1
const SCORE_TAG = 10_000
const SCORE_TITLE_SUBSEQ = 20_000
const SCORE_DESC_SUBSTR = 30_000
const SCORE_DESC_SUBSEQ = 40_000

/** 子串匹配（忽略大小写），命中返回起始下标，否则 -1 */
function indexOfIgnoreCase(haystack: string, needle: string): number {
  return haystack.toLowerCase().indexOf(needle.toLowerCase())
}

/** 子序列模糊匹配：needle 全部字符按序出现在 haystack 中（忽略大小写） */
function isSubsequenceIgnoreCase(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  let i = 0
  for (const ch of h) {
    if (ch === n[i]) {
      i += 1
      if (i === n.length) return true
    }
  }
  return false
}

/** 纯文本模糊匹配（供 UI 高亮等复用）：子串命中或子序列命中 */
export function matchesFuzzy(text: string, query: string): boolean {
  const q = query.trim()
  if (!q) return false
  return indexOfIgnoreCase(text, q) >= 0 || isSubsequenceIgnoreCase(text, q)
}

/** 单条任务匹配得分（越小越靠前）；不匹配返回 null */
function matchScore(task: Task, q: string): number | null {
  const titleIdx = indexOfIgnoreCase(task.title, q)
  if (titleIdx >= 0) return titleIdx === 0 ? 0 : SCORE_TITLE_SUBSTR + titleIdx

  // 标签命中：任一标签子串命中即中（按首个命中标签的下标微调顺序）
  for (const tag of task.tags ?? []) {
    const tagIdx = indexOfIgnoreCase(tag, q)
    if (tagIdx >= 0) return SCORE_TAG + tagIdx
  }

  if (isSubsequenceIgnoreCase(task.title, q)) return SCORE_TITLE_SUBSEQ + task.title.length

  if (task.description) {
    const descIdx = indexOfIgnoreCase(task.description, q)
    if (descIdx >= 0) return SCORE_DESC_SUBSTR + descIdx
    if (isSubsequenceIgnoreCase(task.description, q)) return SCORE_DESC_SUBSEQ + task.description.length
  }
  return null
}

/**
 * 在任务列表中模糊搜索，返回按得分排序的结果（不修改入参）。
 * 空查询返回空数组。
 */
export function searchTasks(tasks: Task[], query: string): SearchResult[] {
  const q = query.trim()
  if (!q) return []
  const results: SearchResult[] = []
  for (const task of tasks) {
    const score = matchScore(task, q)
    if (score != null) results.push({ task, score })
  }
  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    const priority = PRIORITY_ORDER[a.task.priority] - PRIORITY_ORDER[b.task.priority]
    if (priority !== 0) return priority
    if (a.task.date !== b.task.date) {
      if (a.task.date == null) return 1
      if (b.task.date == null) return -1
      return a.task.date < b.task.date ? -1 : 1
    }
    return a.task.title.localeCompare(b.task.title, 'zh')
  })
  return results
}
