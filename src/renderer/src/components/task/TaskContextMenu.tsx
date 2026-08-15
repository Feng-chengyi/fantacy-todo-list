/**
 * 任务右键菜单：编辑 / 放弃 / 删除。
 */
import { useEffect } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'

export function TaskContextMenu() {
  const contextMenu = useUiStore((s) => s.contextMenu)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const openEdit = useUiStore((s) => s.openEdit)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const setOverride = useTaskStore((s) => s.setOverride)

  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
    }
  }, [contextMenu, setContextMenu])

  if (!contextMenu) return null

  const { task, occurrenceDate, x, y } = contextMenu
  const isRepeat = !!task.repeat
  const date = occurrenceDate ?? task.date ?? ''

  interface MenuItem {
    label: string
    danger?: boolean
    onClick: () => void
  }

  // 重复任务实例：右键只提供单日动作（完成/跳过这一天），不提供整体「放弃/删除」；
  // 「放弃」作为整体任务动作（status:abandoned）只出现在非重复任务（整体动作也可在编辑器完成）。
  const menuItems: MenuItem[] = isRepeat
    ? [
        { label: '编辑', onClick: () => openEdit(task, occurrenceDate) },
        { label: '完成这一天', onClick: () => void setOverride(task.id, date, 'done') },
        { label: '跳过这一天', onClick: () => void setOverride(task.id, date, 'skipped') },
      ]
    : [
        { label: '编辑', onClick: () => openEdit(task) },
        { label: '放弃', onClick: () => void updateTask(task.id, { status: 'abandoned' }) },
        { label: '删除', danger: true, onClick: () => void deleteTask(task.id) },
      ]

  return (
    <div
      className="fixed z-50 w-32 rounded-lg py-1 shadow-xl"
      style={{ left: x, top: y, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-black/5"
          style={{ color: item.danger ? 'var(--priority-high)' : 'var(--text)' }}
          onClick={() => {
            item.onClick()
            setContextMenu(null)
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
