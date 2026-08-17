/**
 * v3 待办集页：左右分栏。
 * 左：待办集列表（收集箱固定置顶、不可编辑/删除）+ 新增 + 拖拽排序 + 重命名/删除（右键）；
 * 右：选中集合详情 —— 统计栏（总数/已完成/完成率/累计时长）+ 批量操作
 * （移入集合 / 标记完成 / 批量删除）+ 任务列表 + 新建任务（自动归属当前集合）。
 */
import { useMemo, useState } from 'react'
import { INBOX_ID, collectionStats } from '../../../../shared/collections'
import { formatDurationCompact } from '../../../../shared/time'
import { todayStr } from '../../../../shared/date'
import type { TaskCollection } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { TaskRepoRow } from '../todo/TaskRepoRow'
import { sessionLocalDate } from '../../../../shared/focus'

export function CollectionsPanel() {
  const collections = useTaskStore((s) => s.collections)
  const tasks = useTaskStore((s) => s.tasks)
  const sessions = useTaskStore((s) => s.sessions)
  const createCollection = useTaskStore((s) => s.createCollection)
  const renameCollection = useTaskStore((s) => s.renameCollection)
  const deleteCollection = useTaskStore((s) => s.deleteCollection)
  const reorderCollections = useTaskStore((s) => s.reorderCollections)
  const batchMoveTasks = useTaskStore((s) => s.batchMoveTasks)
  const batchSetStatus = useTaskStore((s) => s.batchSetStatus)
  const batchDeleteTasks = useTaskStore((s) => s.batchDeleteTasks)
  const openCreate = useUiStore((s) => s.openCreate)

  const [selectedId, setSelectedId] = useState<string>(INBOX_ID)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [createValue, setCreateValue] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...collections].sort((a, b) => (a.isSystem === b.isSystem ? a.sortOrder - b.sortOrder : a.isSystem ? -1 : 1)),
    [collections],
  )
  const selected = sorted.find((c) => c.id === selectedId) ?? sorted[0]
  const selectedCollectionId = selected?.id ?? INBOX_ID

  const collectionTasks = useMemo(
    () => tasks.filter((t) => (t.collectionId ?? INBOX_ID) === selectedCollectionId),
    [tasks, selectedCollectionId],
  )
  const stats = useMemo(
    () => collectionStats(tasks, sessions, selectedCollectionId),
    [tasks, sessions, selectedCollectionId],
  )

  const today = todayStr()
  const todaySecByTask = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      if (s.taskId && sessionLocalDate(s.startedAt) === today) {
        map.set(s.taskId, (map.get(s.taskId) ?? 0) + s.durationSec)
      }
    }
    return map
  }, [sessions, today])

  const toggleSelect = (id: string): void => {
    setSelectedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = (): void => setSelectedTasks(new Set())
  const selectedIds = [...selectedTasks]

  const submitCreate = async (): Promise<void> => {
    const name = createValue.trim()
    if (!name) return
    const collection = await createCollection(name)
    setCreating(false)
    setCreateValue('')
    setSelectedId(collection.id)
  }

  const submitRename = async (id: string): Promise<void> => {
    const name = renameValue.trim()
    if (name) await renameCollection(id, name)
    setRenamingId(null)
  }

  const onDrop = (targetId: string): void => {
    if (!dragId || dragId === targetId) return
    const custom = sorted.filter((c) => !c.isSystem).map((c) => c.id)
    const from = custom.indexOf(dragId)
    const to = custom.indexOf(targetId)
    if (from === -1 || to === -1) return
    custom.splice(to, 0, ...custom.splice(from, 1))
    void reorderCollections(custom)
    setDragId(null)
    setDragOverId(null)
  }

  const confirmDelete = (collection: TaskCollection): void => {
    if (window.confirm(`删除待办集「${collection.name}」？内部任务将自动回流收集箱。`)) {
      void deleteCollection(collection.id)
      if (selectedId === collection.id) setSelectedId(INBOX_ID)
    }
  }

  const renderCollectionItem = (c: TaskCollection) => {
    const count = tasks.filter((t) => (t.collectionId ?? INBOX_ID) === c.id && t.status !== 'abandoned').length
    if (renamingId === c.id) {
      return (
        <div key={c.id} className="collection-item">
          <input
            className="collection-rename-input"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => void submitRename(c.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitRename(c.id)
              if (e.key === 'Escape') setRenamingId(null)
            }}
          />
        </div>
      )
    }
    return (
      <div
        key={c.id}
        className={`collection-item ${selectedCollectionId === c.id ? 'active' : ''} ${dragOverId === c.id ? 'drag-over' : ''}`}
        onClick={() => {
          setSelectedId(c.id)
          clearSelection()
        }}
        draggable={!c.isSystem}
        onDragStart={() => setDragId(c.id)}
        onDragOver={(e) => {
          if (dragId && !c.isSystem) {
            e.preventDefault()
            setDragOverId(c.id)
          }
        }}
        onDragLeave={() => setDragOverId((v) => (v === c.id ? null : v))}
        onDrop={() => onDrop(c.id)}
        onDragEnd={() => {
          setDragId(null)
          setDragOverId(null)
        }}
        onContextMenu={(e) => {
          if (c.isSystem) return
          e.preventDefault()
          setRenameValue(c.name)
          setRenamingId(c.id)
        }}
        title={c.isSystem ? '系统收集箱：存放未归类任务（不可删除/重命名）' : '右键重命名；拖拽排序'}
      >
        <span className="collection-name">
          {c.isSystem ? '📥 ' : '🗂 '}
          {c.name}
        </span>
        <span className="collection-count">{count}</span>
        {!c.isSystem && (
          <button
            className="mini-btn"
            title="删除待办集（任务回流收集箱）"
            onClick={(e) => {
              e.stopPropagation()
              confirmDelete(c)
            }}
          >
            ✕
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="collections-layout">
      <div className="collections-left">
        <div className="collections-left-head">
          <span>待办集</span>
          <button
            className="mini-btn"
            title="新建待办集"
            onClick={() => {
              setCreating(true)
              setCreateValue('')
            }}
          >
            ＋ 新建
          </button>
        </div>
        {creating && (
          <div className="collection-item">
            <input
              className="collection-rename-input"
              placeholder="待办集名称"
              value={createValue}
              autoFocus
              onChange={(e) => setCreateValue(e.target.value)}
              onBlur={() => void submitCreate()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitCreate()
                if (e.key === 'Escape') setCreating(false)
              }}
            />
          </div>
        )}
        {sorted.map(renderCollectionItem)}
      </div>

      <div className="collections-right">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-base font-bold">
              {selected?.isSystem ? '📥 ' : '🗂 '}
              {selected?.name ?? '收集箱'}
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              共 {collectionTasks.length} 项
            </span>
          </div>
          <button
            className="primary-btn"
            onClick={() => openCreate(today, { collectionId: selectedCollectionId })}
          >
            新建任务
          </button>
        </div>

        <div className="collections-stats-row">
          <span>
            任务总数：<b>{stats.total}</b>
          </span>
          <span>
            已完成：<b>{stats.done}</b>
          </span>
          <span>
            完成率：<b>{Math.round(stats.rate * 100)}%</b>
          </span>
          <span>
            累计计时：<b>{formatDurationCompact(stats.focusSec)}</b>
          </span>
        </div>

        <div className="batch-bar">
          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              className="select-check"
              checked={collectionTasks.length > 0 && selectedIds.length === collectionTasks.length}
              onChange={(e) =>
                setSelectedTasks(e.target.checked ? new Set(collectionTasks.map((t) => t.id)) : new Set())
              }
            />
            全选
          </label>
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                已选 {selectedIds.length} 项
              </span>
              <select
                className="select"
                style={{ height: 26, fontSize: 12 }}
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    void batchMoveTasks(selectedIds, e.target.value)
                    clearSelection()
                  }
                }}
              >
                <option value="">移入待办集…</option>
                {sorted
                  .filter((c) => c.id !== selectedCollectionId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                {selectedCollectionId !== INBOX_ID && <option value={INBOX_ID}>移回收集箱</option>}
              </select>
              <button
                className="ghost-btn"
                onClick={() => {
                  void batchSetStatus(selectedIds, 'done')
                  clearSelection()
                }}
              >
                批量完成
              </button>
              <button
                className="danger-btn"
                style={{ height: 26, padding: '0 10px', fontSize: 12 }}
                onClick={() => {
                  if (window.confirm(`删除选中的 ${selectedIds.length} 项任务？`)) {
                    void batchDeleteTasks(selectedIds)
                    clearSelection()
                  }
                }}
              >
                批量删除
              </button>
              <button className="ghost-btn" onClick={clearSelection}>
                取消选择
              </button>
            </>
          )}
        </div>

        {collectionTasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            该待办集暂无任务，点击右上角「新建任务」添加
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {collectionTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="select-check"
                  checked={selectedTasks.has(task.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(task.id)}
                />
                <div className="min-w-0 flex-1">
                  <TaskRepoRow task={task} todaySec={todaySecByTask.get(task.id) ?? 0} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
