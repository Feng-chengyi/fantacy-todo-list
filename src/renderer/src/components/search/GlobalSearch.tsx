/**
 * 全局搜索弹层：按名称 / 标签 / 描述模糊检索任务（shared/search.searchTasks）。
 * 点击结果：关闭编辑弹窗后跳转待办页并打开该任务编辑。Esc / 点遮罩关闭。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../../../../shared/types'
import { searchTasks } from '../../../../shared/search'
import { PRIORITY_LABELS } from '../../../../shared/defaults'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'

export function GlobalSearch() {
  const showSearch = useUiStore((s) => s.showSearch)
  const setShowSearch = useUiStore((s) => s.setShowSearch)
  const closeEditor = useUiStore((s) => s.closeEditor)
  const openEdit = useUiStore((s) => s.openEdit)
  const setPage = useUiStore((s) => s.setPage)
  const tasks = useTaskStore((s) => s.tasks)

  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const results = useMemo(() => searchTasks(tasks, query), [tasks, query])

  // 打开时聚焦输入框；关闭时清空查询（避免下次打开残留上次结果）
  useEffect(() => {
    if (showSearch) {
      setQuery('')
      const id = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
  }, [showSearch])

  // Esc 关闭
  useEffect(() => {
    if (!showSearch) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShowSearch(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSearch, setShowSearch])

  if (!showSearch) return null

  const open = (task: Task): void => {
    closeEditor()
    openEdit(task)
    // v3：所有任务统一在待办页管理，搜索命中后跳转待办页打开编辑弹窗
    setPage('todo')
    setShowSearch(false)
  }

  return (
    <div className="global-search-mask" onClick={() => setShowSearch(false)}>
      <div className="global-search-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="input w-full"
          placeholder="搜索任务名称、标签或描述…（Esc 关闭）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="global-search-results">
          {query.trim() === '' ? (
            <div className="global-search-empty">输入关键词开始搜索</div>
          ) : results.length === 0 ? (
            <div className="global-search-empty">无匹配结果</div>
          ) : (
            results.map((r) => {
              const t = r.task
              return (
                <button
                  key={t.id}
                  className={`global-search-item ${t.status !== 'pending' ? 'done' : ''}`}
                  onClick={() => open(t)}
                >
                  <span className="global-search-priority" data-priority={t.priority}>
                    {PRIORITY_LABELS[t.priority]}
                  </span>
                  <span className="global-search-title">{t.title}</span>
                  <span className="global-search-meta">
                    {t.date == null ? '收集箱' : t.date}
                    {t.tags.length > 0 ? ` · ${t.tags.join(' / ')}` : ''}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
