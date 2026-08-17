/**
 * v3.1 任务右键菜单：计时控制 / 编辑 / 复制任务 / 完成切换（P1-2 增强）；
 * 放弃与删除为破坏性操作，统一 ConfirmDialog 二次确认（F4）。
 */
import { useEffect, useState } from 'react'
import type { Task } from '../../../../shared/types'
import { isSameTimerInstance } from '../../../../shared/focus'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { commitFocus, switchTimer } from '../../services/focus'
import { ConfirmDialog } from '../stats/ConfirmDialog'

/** 待二次确认的破坏性操作（携带任务快照：菜单关闭后弹窗仍可独立渲染） */
type PendingAction = { action: 'abandon' | 'delete'; task: Task }

export function TaskContextMenu() {
  const contextMenu = useUiStore((s) => s.contextMenu)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const openEdit = useUiStore((s) => s.openEdit)
  const timer = useUiStore((s) => s.timer)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const setStatus = useTaskStore((s) => s.setStatus)
  const createTask = useTaskStore((s) => s.createTask)
  const [pending, setPending] = useState<PendingAction | null>(null)

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

  // 菜单关闭但确认弹窗挂起时仍需渲染（ConfirmDialog 寄生在本组件内）
  if (!contextMenu && pending === null) return null

  const task = contextMenu?.task ?? pending?.task
  if (!task) return null
  const { x, y } = contextMenu ?? { x: 0, y: 0 }
  // 计时实例口径与计时面板/任务仓库行一致：周期任务任务级（null），非周期用其日期
  const occurrenceDate = task.repeat ? null : (task.date ?? null)
  const isTiming = !!timer && isSameTimerInstance(timer, task.id, occurrenceDate)
  const done = task.status === 'done'
  const abandoned = task.status === 'abandoned'
  const type = task.taskType ?? 'normal'

  /** 复制任务（P1-2）：复制标题/优先级/日期/分类/颜色/重复/提醒等核心字段 */
  const duplicateTask = (): void => {
    void createTask({
      title: `${task.title}（副本）`,
      priority: task.priority,
      date: task.date,
      description: task.description,
      repeat: task.repeat ?? null,
      category: task.category,
      color: task.color,
      startTime: task.startTime,
      endTime: task.endTime,
      reminder: task.reminder ?? null,
      taskType: type,
      collectionId: task.collectionId,
      countdownSec: task.countdownSec,
    })
  }

  interface MenuItem {
    label: string
    danger?: boolean
    disabled?: boolean
    onClick: () => void
  }

  const menuItems: MenuItem[] = [
    isTiming
      ? {
          label: '⏹ 停止计时',
          onClick: () => void commitFocus(),
        }
      : {
          label: '▶ 开始计时',
          disabled: type === 'goal' || (task.timerKind ?? 'stopwatch') === 'none' || done || abandoned,
          onClick: () => {
            // 走时由悬浮窗接管，无需跳转页面
            void switchTimer(task.id, occurrenceDate)
          },
        },
    { label: '✏️ 编辑', onClick: () => openEdit(task) },
    { label: '⧉ 复制任务', onClick: duplicateTask },
  ]
  if (!abandoned && type !== 'habit') {
    menuItems.push({
      label: done ? '↩️ 重新打开' : '✅ 标记完成',
      onClick: () => void setStatus(task.id, done ? 'pending' : 'done'),
    })
  }
  if (!abandoned && !done) {
    menuItems.push({ label: '🚫 放弃', danger: true, onClick: () => setPending({ action: 'abandon', task }) })
  }
  menuItems.push({ label: '🗑 删除', danger: true, onClick: () => setPending({ action: 'delete', task }) })

  const confirmPending = (): void => {
    if (!pending) return
    if (pending.action === 'abandon') void updateTask(pending.task.id, { status: 'abandoned' })
    else void deleteTask(pending.task.id)
    setPending(null)
    setContextMenu(null)
  }

  return (
    <>
      {contextMenu && (
        <div
          className="fixed z-50 w-36 rounded-lg py-1 shadow-xl"
          style={{
            left: Math.min(x, window.innerWidth - 160),
            top: Math.min(y, window.innerHeight - 260),
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-black/5"
              style={{ color: item.danger ? 'var(--priority-high)' : 'var(--text)', opacity: item.disabled ? 0.4 : 1 }}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                item.onClick()
                // 破坏性操作（放弃/删除）挂起确认弹窗；其余操作点击后直接收起菜单
                setContextMenu(null)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {pending !== null && (
        <ConfirmDialog
          title={
            pending.action === 'abandon'
              ? `放弃任务「${pending.task.title}」`
              : `删除任务「${pending.task.title}」`
          }
          detail={
            pending.action === 'abandon'
              ? '放弃后任务将不再出现在默认列表，可在「全部」筛选中恢复。'
              : '删除后该任务及其专注记录将一并移除。'
          }
          confirmLabel={pending.action === 'abandon' ? '确认放弃' : '确认删除'}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  )
}
