/**
 * 任务新建/编辑面板：标题 / 日期 / 优先级 / 重复规则 / 备注 / 保存 / 放弃 / 删除。
 */
import { useEffect, useState } from 'react'
import type { Priority, RepeatRule } from '../../../../shared/types'
import { PRIORITY_LABELS } from '../../../../shared/defaults'
import { todayStr } from '../../../../shared/date'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { RepeatRuleEditor } from './RepeatRuleEditor'

const PRIORITIES: Priority[] = ['high', 'medium', 'low']

export function TaskEditorModal() {
  const editor = useUiStore((s) => s.editor)
  const closeEditor = useUiStore((s) => s.closeEditor)
  const createTask = useTaskStore((s) => s.createTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState<string>(todayStr())
  const [inInbox, setInInbox] = useState(false)
  const [priority, setPriority] = useState<Priority>('medium')
  const [repeat, setRepeat] = useState<RepeatRule | null>(null)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!editor) return
    setTitle(editor.task?.title ?? '')
    setDate(editor.task?.date ?? editor.date ?? todayStr())
    setInInbox(editor.task ? editor.task.date === null : editor.date === null)
    setPriority(editor.task?.priority ?? 'medium')
    setRepeat(editor.task?.repeat ?? null)
    setDescription(editor.task?.description ?? '')
  }, [editor])

  if (!editor) return null

  const isEdit = editor.task != null

  const save = async (): Promise<void> => {
    if (!title.trim()) return
    const finalDate = inInbox ? null : date
    if (isEdit) {
      await updateTask(editor.task!.id, {
        title: title.trim(),
        date: finalDate,
        priority,
        repeat,
        description,
      })
    } else {
      await createTask({ title: title.trim(), date: finalDate, priority, repeat, description })
    }
    closeEditor()
  }

  // 编辑面板为「任务级」操作：放弃 = 整体放弃，删除 = 删除整个任务。
  // 单实例「跳过/单独完成」在右键菜单与勾选中处理（走 override）。
  const abandon = async (): Promise<void> => {
    if (!isEdit) return
    await updateTask(editor.task!.id, { status: 'abandoned' })
    closeEditor()
  }

  const remove = async (): Promise<void> => {
    if (!isEdit) return
    await deleteTask(editor.task!.id)
    closeEditor()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40" onClick={closeEditor}>
      <div
        className="w-[440px] rounded-xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold">{isEdit ? '编辑任务' : '新建任务'}</h2>

        <input
          className="input mb-3 w-full"
          placeholder="任务标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div className="mb-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--text-muted)' }}>优先级</span>
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={inInbox} onChange={(e) => setInInbox(e.target.checked)} />
            <span style={{ color: 'var(--text-muted)' }}>收集箱（不安排日期）</span>
          </label>
        </div>

        {!inInbox && (
          <div className="mb-3">
            <input type="date" className="input w-full" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}

        <div className="mb-3">
          <RepeatRuleEditor value={repeat} onChange={setRepeat} />
        </div>

        <textarea
          className="input mb-4 w-full resize-none"
          rows={2}
          placeholder="备注（可选）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2">
          {isEdit && (
            <>
              <button className="danger-btn" onClick={() => void abandon()}>
                放弃
              </button>
              <button className="danger-btn" onClick={() => void remove()}>
                删除
              </button>
            </>
          )}
          <button className="ghost-btn" onClick={closeEditor}>
            取消
          </button>
          <button className="primary-btn" disabled={!title.trim()} onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
