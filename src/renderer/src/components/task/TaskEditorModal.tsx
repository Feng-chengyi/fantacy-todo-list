/**
 * 任务新建/编辑面板：标题 / 日期 / 优先级 / 重复规则 / 备注 / 起止时间 / 正向计时 / 保存 / 放弃 / 删除。
 */
import { useEffect, useMemo, useState } from 'react'
import type { Priority, RepeatRule, Task } from '../../../../shared/types'
import { CATEGORY_PRESETS, COLOR_PRESETS, PRIORITY_LABELS } from '../../../../shared/defaults'
import { todayStr } from '../../../../shared/date'
import { hasOverlap } from '../../../../shared/conflict'
import { formatDurationMinutes, timeToMinutes } from '../../../../shared/time'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { commitFocus, switchTimer } from '../../services/focus'
import { RepeatRuleEditor } from './RepeatRuleEditor'
import { Stopwatch } from './Stopwatch'

const PRIORITIES: Priority[] = ['high', 'medium', 'low']

export function TaskEditorModal() {
  const editor = useUiStore((s) => s.editor)
  const closeEditor = useUiStore((s) => s.closeEditor)
  const timer = useUiStore((s) => s.timer)
  const openTimerPanel = useUiStore((s) => s.openTimerPanel)
  const createTask = useTaskStore((s) => s.createTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const moveTask = useTaskStore((s) => s.moveTask)
  const tasks = useTaskStore((s) => s.tasks)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState<string>(todayStr())
  const [inInbox, setInInbox] = useState(false)
  const [priority, setPriority] = useState<Priority>('medium')
  const [repeat, setRepeat] = useState<RepeatRule | null>(null)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  useEffect(() => {
    if (!editor) return
    setTitle(editor.task?.title ?? '')
    setDate(editor.task?.date ?? editor.date ?? todayStr())
    setInInbox(editor.task ? editor.task.date === null : editor.date === null)
    setPriority(editor.task?.priority ?? 'medium')
    setRepeat(editor.task?.repeat ?? null)
    setDescription(editor.task?.description ?? '')
    setCategory(editor.task?.category ?? '')
    setColor(editor.task?.color ?? '')
    setStartTime(editor.task?.startTime ?? '')
    setEndTime(editor.task?.endTime ?? '')
  }, [editor])

  // 起止时间校验：两者都填时 startTime 必须 < endTime
  const timeError = !!startTime && !!endTime && timeToMinutes(startTime) >= timeToMinutes(endTime)

  // 时间冲突检测：与「同一天 + 有时间区间」的其它任务做半开区间重叠判断
  const conflicts = useMemo<Task[]>(() => {
    if (inInbox || !date || !startTime || !endTime) return []
    const selfId = editor?.task?.id
    const candidate = { id: selfId ?? '__new__', date, startTime, endTime }
    return tasks.filter((t) => t.id !== selfId && hasOverlap(candidate, t))
  }, [tasks, inInbox, date, startTime, endTime, editor])

  if (!editor) return null

  const isEdit = editor.task != null

  const save = async (): Promise<void> => {
    if (!title.trim() || timeError) return
    const finalDate = inInbox ? null : date
    const timePatch = { startTime: startTime || undefined, endTime: endTime || undefined }
    if (isEdit) {
      // 日期变化统一走 moveTask（与拖拽改期一致：清空重复任务旧 overrides、收集箱排序）
      if (finalDate !== editor.task!.date) {
        await moveTask(editor.task!.id, finalDate)
      }
      await updateTask(editor.task!.id, {
        title: title.trim(),
        priority,
        repeat,
        description,
        category: category.trim(),
        color: color.trim(),
        ...timePatch,
      })
    } else {
      await createTask({
        title: title.trim(),
        date: finalDate,
        priority,
        repeat,
        description,
        category: category.trim(),
        color: color.trim(),
        ...timePatch,
      })
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
          <>
            <div className="mb-3">
              <input type="date" className="input w-full" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="mb-3 flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>开始</span>
                <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>结束</span>
                <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                留空 = 全天
              </span>
            </div>

            {timeError && <div className="time-error">开始时间需早于结束时间</div>}

            {conflicts.length > 0 && (
              <div className="conflict-warning">
                ⚠ 时间冲突：{conflicts.map((t) => `『${t.title}』`).join('、')}
              </div>
            )}
          </>
        )}

        {isEdit && (
          <div className="mb-3 flex items-center gap-2">
            <Stopwatch taskId={editor.task!.id} />
            {timer?.taskId === editor.task!.id ? (
              <button className="ghost-btn" onClick={() => void commitFocus()}>
                停止计时
              </button>
            ) : (
              <button
                className="ghost-btn"
                onClick={() => {
                  // 先提交旧计时再开新计时，保证切换任务不丢上一任务时长（QA Bug 1）
                  void switchTimer(editor.task!.id)
                  // 定向：切到主界面计时器面板并立即开始计时
                  closeEditor()
                  openTimerPanel()
                }}
              >
                开始计时
              </button>
            )}
            {editor.task!.durationSec != null && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                用时 {formatDurationMinutes(editor.task!.durationSec)}
              </span>
            )}
          </div>
        )}

        <div className="mb-3">
          <RepeatRuleEditor value={repeat} onChange={setRepeat} />
        </div>

        <div className="mb-3">
          <div className="mb-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            分类
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {CATEGORY_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`category-chip ${category === c ? 'active' : ''}`}
                onClick={() => setCategory(category === c ? '' : c)}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            className="input w-full"
            placeholder="自定义分类（可选）"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              颜色
            </span>
            {color && (
              <button
                type="button"
                className="mini-btn"
                onClick={() => setColor('')}
              >
                使用优先级色
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${color === c ? 'active' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => setColor(color === c ? '' : c)}
              />
            ))}
            <label
              className="color-swatch color-swatch-custom"
              title="自定义颜色"
              style={{ background: color || 'conic-gradient(#e5484d,#f5a623,#22c55e,#3b82f6,#8b5cf6,#e5484d)' }}
            >
              <input
                type="color"
                className="color-input"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6c5ce7'}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
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
          <button
            className="primary-btn"
            disabled={!title.trim() || timeError}
            onClick={() => void save()}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
