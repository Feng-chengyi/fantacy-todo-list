/**
 * 任务右键菜单（任务仓库行）：开始/停止计时、编辑、放弃、删除。
 */
import { useEffect } from 'react'
import { isSameTimerInstance } from '../../../../shared/focus'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { commitFocus, switchTimer } from '../../services/focus'

export function TaskContextMenu() {
  const contextMenu = useUiStore((s) => s.contextMenu)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const openEdit = useUiStore((s) => s.openEdit)
  const openTimerPanel = useUiStore((s) => s.openTimerPanel)
  const timer = useUiStore((s) => s.timer)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)

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

  const { task, x, y } = contextMenu
  // 计时实例口径与计时面板/任务仓库行一致：周期任务任务级（null），非周期用其日期
  const occurrenceDate = task.repeat ? null : (task.date ?? null)
  const isTiming = !!timer && isSameTimerInstance(timer, task.id, occurrenceDate)

  interface MenuItem {
    label: string
    danger?: boolean
    onClick: () => void
  }

  const menuItems: MenuItem[] = [
    isTiming
      ? {
          label: '停止计时',
          onClick: () => void commitFocus(),
        }
      : {
          label: '开始计时',
          onClick: () => {
            void switchTimer(task.id, occurrenceDate)
            openTimerPanel()
          },
        },
    { label: '编辑', onClick: () => openEdit(task) },
  ]
  if (task.status !== 'abandoned') {
    menuItems.push({ label: '放弃', onClick: () => void updateTask(task.id, { status: 'abandoned' }) })
  }
  menuItems.push({ label: '删除', danger: true, onClick: () => void deleteTask(task.id) })

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
