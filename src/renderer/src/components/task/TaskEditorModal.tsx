/**
 * v3 任务新建/编辑弹窗：
 * - 顶部类型 tabs：普通待办 / 习惯 / 目标（习惯=周期任务+每日打卡；目标=进度+截止）；
 * - 基础区：标题 + 截止/安排日期 + 所属待办集；
 * - 高级配置（优先级/提醒/起止时间/分类/颜色/备注）默认折叠，「更多高级设置」展开；
 * - 计时类型：正向计时 / 倒计时（可设时长）；编辑态保留开始计时入口（悬浮窗走时）。
 */
import { useEffect, useMemo, useState } from 'react'
import type { Priority, RepeatRule, Task, TaskType, TimerKind } from '../../../../shared/types'
import { CATEGORY_PRESETS, COLOR_PRESETS, PRIORITY_LABELS } from '../../../../shared/defaults'
import { todayStr } from '../../../../shared/date'
import { isSameTimerInstance } from '../../../../shared/focus'
import { formatDurationMinutes, timeToMinutes } from '../../../../shared/time'
import { INBOX_ID } from '../../../../shared/collections'
import { useTaskStore } from '../../stores/taskStore'
import { useConfigStore } from '../../stores/configStore'
import { useUiStore } from '../../stores/uiStore'
import { commitFocus, switchTimer } from '../../services/focus'
import { RepeatRuleEditor } from './RepeatRuleEditor'

const PRIORITIES: Priority[] = ['high', 'medium', 'low']
const TYPE_TABS: { key: TaskType; label: string }[] = [
  { key: 'normal', label: '普通待办' },
  { key: 'habit', label: '习惯' },
  { key: 'goal', label: '目标' },
]

export function TaskEditorModal() {
  const editor = useUiStore((s) => s.editor)
  const closeEditor = useUiStore((s) => s.closeEditor)
  const timer = useUiStore((s) => s.timer)
  const createTask = useTaskStore((s) => s.createTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const moveTask = useTaskStore((s) => s.moveTask)
  const tasks = useTaskStore((s) => s.tasks)
  const collections = useTaskStore((s) => s.collections)
  const reminderDefaultTime = useConfigStore((s) => s.reminderDefaultTime ?? '09:00')

  const [taskType, setTaskType] = useState<TaskType>('normal')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<string>('')
  const [collectionId, setCollectionId] = useState<string>(INBOX_ID)
  const [repeat, setRepeat] = useState<RepeatRule | null>(null)
  const [progressValue, setProgressValue] = useState(0)
  const [timerKind, setTimerKind] = useState<TimerKind>('stopwatch')
  const [countdownSec, setCountdownSec] = useState(25 * 60)
  // 高级配置（默认折叠）
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [priority, setPriority] = useState<Priority>('medium')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState('')

  useEffect(() => {
    if (!editor) return
    const t = editor.task
    setTitle(t?.title ?? '')
    setTaskType(t?.taskType ?? 'normal')
    setDate(t?.date ?? editor.date ?? '')
    setCollectionId(t?.collectionId ?? editor.collectionId ?? INBOX_ID)
    setRepeat(t?.repeat ?? (t?.taskType === 'habit' ? { type: 'daily', interval: 1 } : null))
    setProgressValue(t?.progressValue ?? 0)
    setTimerKind(t?.timerKind ?? 'stopwatch')
    setCountdownSec(t?.countdownSec ?? 25 * 60)
    setShowAdvanced(false)
    setPriority(t?.priority ?? 'medium')
    setDescription(t?.description ?? '')
    setCategory(t?.category ?? '')
    setColor(t?.color ?? '')
    setStartTime(t?.startTime ?? '')
    setEndTime(t?.endTime ?? '')
    setReminderEnabled(!!t?.reminder)
    setReminderTime(t?.reminder?.time ?? reminderDefaultTime)
  }, [editor, reminderDefaultTime])

  // 起止时间校验：两者都填时 startTime 必须 < endTime
  const timeError = !!startTime && !!endTime && timeToMinutes(startTime) >= timeToMinutes(endTime)

  // 时间冲突检测：与「同一天 + 有时间区间」的其它任务做半开区间重叠判断
  const conflicts = useMemo<Task[]>(() => {
    if (!date || !startTime || !endTime) return []
    const selfId = editor?.task?.id
    const candidate = { id: selfId ?? '__new__', date, startTime, endTime }
    return tasks.filter((t) => t.id !== selfId && hasOverlapShim(candidate, t))
  }, [tasks, date, startTime, endTime, editor])

  if (!editor) return null

  const isEdit = editor.task != null

  const save = async (): Promise<void> => {
    if (!title.trim() || timeError) return
    const finalDate = date || null
    const timePatch = { startTime: startTime || undefined, endTime: endTime || undefined }
    const reminderPatch = { reminder: reminderEnabled ? { time: reminderTime } : null }
    const common = {
      title: title.trim(),
      priority,
      description,
      category: category.trim(),
      color: color.trim(),
      ...timePatch,
      ...reminderPatch,
    }
    if (isEdit) {
      // 日期变化统一走 moveTask（与拖拽改期一致：清空重复任务旧 overrides、收集箱排序）
      if (finalDate !== editor.task!.date) {
        await moveTask(editor.task!.id, finalDate)
      }
      await updateTask(editor.task!.id, {
        ...common,
        taskType,
        collectionId: collectionId || INBOX_ID,
        repeat: taskType === 'habit' ? (repeat ?? { type: 'daily', interval: 1 }) : repeat,
        progressValue: taskType === 'goal' ? Math.max(0, Math.min(100, progressValue)) : undefined,
        timerKind: taskType === 'goal' ? 'none' : timerKind,
        countdownSec: taskType !== 'goal' && timerKind === 'countdown' ? countdownSec : undefined,
      })
    } else {
      await createTask({
        ...common,
        date: finalDate,
        taskType,
        collectionId: collectionId || INBOX_ID,
        repeat: taskType === 'habit' ? (repeat ?? { type: 'daily', interval: 1 }) : repeat,
        countdownSec: taskType !== 'goal' && timerKind === 'countdown' ? countdownSec : undefined,
      })
    }
    closeEditor()
  }

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

  const editingTask = editor.task

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40" onClick={closeEditor}>
      <div
        className="max-h-[86vh] w-[440px] overflow-y-auto rounded-xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold">{isEdit ? '编辑任务' : '新建任务'}</h2>

        {/* 类型 tabs（新建可选；编辑已有任务也可切换类型） */}
        <div className="editor-type-tabs">
          {TYPE_TABS.map((tab) => (
            <button key={tab.key} className={taskType === tab.key ? 'active' : ''} onClick={() => setTaskType(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        <input
          className="input mb-3 w-full"
          placeholder={taskType === 'habit' ? '习惯名称（如：每日阅读）' : taskType === 'goal' ? '目标名称（如：完成毕业论文）' : '任务标题'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        {/* 基础区：日期 + 所属待办集 */}
        <div className="mb-3 flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-sm">
            <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              {taskType === 'goal' ? '截止日期' : '安排日期'}
            </span>
            <input type="date" className="input w-full" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="mb-3 flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-sm">
            <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              所属待办集
            </span>
            <select className="select w-full" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
              {collections
                .slice()
                .sort((a, b) => (a.isSystem === b.isSystem ? a.sortOrder - b.sortOrder : a.isSystem ? -1 : 1))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.isSystem ? '📥 ' : ''}
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {/* 习惯：周期规则 */}
        {taskType === 'habit' && (
          <div className="mb-3">
            <RepeatRuleEditor value={repeat ?? { type: 'daily', interval: 1 }} onChange={setRepeat} />
            <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              习惯任务常驻待办清单，在任务行勾选即可完成每日打卡。
            </div>
          </div>
        )}

        {/* 目标：进度 + 截止倒计时说明 */}
        {taskType === 'goal' && (
          <div className="mb-3">
            <label className="setting-row">
              <span>当前进度</span>
              <span className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progressValue}
                  className="setting-slider"
                  onChange={(e) => setProgressValue(Number(e.target.value))}
                />
                <b style={{ color: 'var(--accent)', minWidth: 34, textAlign: 'right' }}>{Math.round(progressValue)}%</b>
              </span>
            </label>
            <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              目标任务自带总进度圆环与截止倒计时展示，不参与计时。
            </div>
          </div>
        )}

        {/* 计时类型：正向 / 倒计时（目标任务不计时） */}
        {taskType !== 'goal' && (
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              计时方式
            </span>
            <div className="filter-tabs">
              <button className={timerKind === 'stopwatch' ? 'active' : ''} onClick={() => setTimerKind('stopwatch')}>
                正向计时
              </button>
              <button className={timerKind === 'countdown' ? 'active' : ''} onClick={() => setTimerKind('countdown')}>
                倒计时
              </button>
              <button className={timerKind === 'none' ? 'active' : ''} onClick={() => setTimerKind('none')}>
                不计时
              </button>
            </div>
            {timerKind === 'countdown' && (
              <input
                type="number"
                min={1}
                className="input"
                style={{ width: 86 }}
                value={Math.round(countdownSec / 60)}
                onChange={(e) => setCountdownSec(Math.max(1, Math.floor(Number(e.target.value) || 1)) * 60)}
                title="倒计时分钟数"
              />
            )}
            {timerKind === 'countdown' && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>分钟</span>}
          </div>
        )}

        {/* 编辑态：计时入口（走时由悬浮窗接管） */}
        {isEdit && editingTask && (
          <div className="mb-3 flex items-center gap-2">
            {(() => {
              const timerOcc = editingTask.repeat ? null : (editingTask.date ?? null)
              const timing = !!timer && isSameTimerInstance(timer, editingTask.id, timerOcc)
              return (
                <>
                  {timing ? (
                    <button className="ghost-btn" onClick={() => void commitFocus()}>
                      停止计时
                    </button>
                  ) : (
                    <button
                      className="ghost-btn"
                      onClick={() => {
                        // 先提交旧计时再开新计时，保证切换任务不丢上一任务时长（QA Bug 1）
                        void switchTimer(editingTask.id, timerOcc)
                        closeEditor()
                      }}
                    >
                      开始计时
                    </button>
                  )}
                </>
              )
            })()}
            {editingTask.durationSec != null && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                用时 {formatDurationMinutes(editingTask.durationSec)}
              </span>
            )}
          </div>
        )}

        {/* 高级配置：默认折叠 */}
        <div className="mb-3">
          <button className="advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? '▾ 收起高级设置' : '▸ 更多高级设置（优先级 / 提醒 / 分类等）'}
          </button>
          {showAdvanced && (
            <div className="advanced-section">
              <div className="flex items-center gap-3">
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
              </div>

              {date && (
                <>
                  <div className="flex items-center gap-2">
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
                    <div className="conflict-warning">⚠ 时间冲突：{conflicts.map((t) => `『${t.title}』`).join('、')}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={reminderEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setReminderEnabled(checked)
                          if (checked && !reminderTime) setReminderTime(reminderDefaultTime)
                        }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>设置提醒</span>
                    </label>
                    {reminderEnabled && (
                      <input type="time" className="input" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                    )}
                  </div>
                </>
              )}

              {taskType !== 'habit' && !isEdit && (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  <RepeatRuleEditor value={repeat} onChange={setRepeat} />
                </div>
              )}

              <div>
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

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    颜色
                  </span>
                  {color && (
                    <button type="button" className="mini-btn" onClick={() => setColor('')}>
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
                className="input w-full resize-none"
                rows={2}
                placeholder="备注（可选）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}
        </div>

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
          <button className="primary-btn" disabled={!title.trim() || timeError} onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

/** 半开区间重叠判断（与 shared/conflict 同口径，弹窗内联避免额外依赖） */
function hasOverlapShim(
  a: { date: string | null; startTime?: string; endTime?: string },
  b: Task,
): boolean {
  if (a.date == null || b.date == null || a.date !== b.date) return false
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime)
}
