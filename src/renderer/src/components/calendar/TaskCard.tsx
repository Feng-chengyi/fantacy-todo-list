/**
 * 任务卡：优先级色条 + 标题 + 勾选；可拖拽；右键菜单。
 * 支持两种布局变体：
 * - compact：月视图单行紧凑（标题截断，不展示备注）。
 * - roomy：周/日视图多行宽裕（标题可换行 + 备注片段 + 时间 + 分类色点）。
 */
import { useDraggable } from '@dnd-kit/core'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import type { Occurrence } from '../../../../shared/types'
import { taskColor } from '../../../../shared/defaults'
import { isSameTimerInstance } from '../../../../shared/focus'
import { formatDurationMinutes } from '../../../../shared/time'
import { fireConfetti } from '../../lib/confetti'
import * as api from '../../services/ipc'
import { useConfigStore } from '../../stores/configStore'
import { useTaskStore } from '../../stores/taskStore'
import { useUiStore } from '../../stores/uiStore'
import { commitFocus, switchTimer } from '../../services/focus'
import { Stopwatch } from '../task/Stopwatch'

/** 备注截断：去多余空白后按长度截断并补「…」 */
function truncate(text: string, max: number): string {
  if (max <= 0) return ''
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return t.slice(0, max) + '…'
}

export type TaskCardVariant = 'compact' | 'roomy'

interface Props {
  occurrence: Occurrence
  /** 是否高亮时间冲突（日/周视图传入，由父级统一计算） */
  conflict?: boolean
  /** 布局变体：月视图 compact（默认），周/日视图 roomy */
  variant?: TaskCardVariant
}

export function TaskCard({ occurrence, conflict = false, variant = 'compact' }: Props) {
  const { task, date, status } = occurrence
  const setStatus = useTaskStore((s) => s.setStatus)
  const setOverride = useTaskStore((s) => s.setOverride)
  const clearOverride = useTaskStore((s) => s.clearOverride)
  const confettiEnabled = useConfigStore((s) => s.confettiEnabled)
  const showNotes = useConfigStore((s) => s.showNotesInCalendar)
  const noteTruncateLength = useConfigStore((s) => s.noteTruncateLength)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const timer = useUiStore((s) => s.timer)
  const openTimerPanel = useUiStore((s) => s.openTimerPanel)

  // 重复任务：任何实例（含 anchor 日期）的勾选都走单实例 override（PRD P0-05 单日独立操作）
  const isRepeat = !!task.repeat
  const done = status === 'done'
  const abandoned = status === 'abandoned'
  const isTiming = !!timer && isSameTimerInstance(timer, task.id, date)
  const isRoomy = variant === 'roomy'

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    // 重复任务在月历上有多个实例，dnd id 必须唯一：task.id + 实例日期
    id: `${task.id}-${date}`,
    data: { occurrenceDate: date },
  })

  const style: CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.6 : 1,
  }

  /** 完成时若正在对该任务实例计时，统一走 commitFocus 落库（含 5 秒下限过滤） */
  const recordDuration = (): void => {
    if (timer && isSameTimerInstance(timer, task.id, date)) {
      void commitFocus()
    }
  }

  const toggleDone = (e: MouseEvent) => {
    e.stopPropagation()
    if (abandoned) return
    if (isRepeat) {
      if (done) void clearOverride(task.id, date)
      else {
        void setOverride(task.id, date, 'done')
        if (!done && confettiEnabled) fireConfetti()
        recordDuration()
        void api.notifyPetAnim({ anim: 'finishing' })
      }
    } else {
      void setStatus(task.id, done ? 'pending' : 'done')
      if (!done && confettiEnabled) fireConfetti()
      if (!done) {
        recordDuration()
        void api.notifyPetAnim({ anim: 'finishing' })
      }
    }
  }

  const onStartTimer = (e: MouseEvent) => {
    e.stopPropagation()
    // 切换计时统一入口：先提交上一个任务的计时（不丢时长），再开新计时（QA Bug 1）
    void switchTimer(task.id, date)
    // 定向：切到主界面计时器面板并立即开始计时
    openTimerPanel()
  }

  const onStopTimer = (e: MouseEvent) => {
    e.stopPropagation()
    // 停止即结束本段计时，统一走 commitFocus（含 5 秒下限过滤）
    void commitFocus()
  }

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ task, occurrenceDate: isRepeat ? date : undefined, x: e.clientX, y: e.clientY })
  }

  // 备注片段：仅 roomy（周/日视图）展示；compact（月视图）保持单行紧凑不展示
  const note = isRoomy && showNotes && task.description ? truncate(task.description, noteTruncateLength) : ''
  const timeLabel = task.startTime ?? ''
  const category = task.category?.trim() ?? ''

  // 正向计时控件（compact 与 roomy 均在标题行右侧展示）
  const timerControls: ReactNode = isTiming ? (
    <>
      <Stopwatch taskId={task.id} occurrenceDate={date} />
      <button className="mini-btn timer-btn" onClick={onStopTimer} title="停止计时">
        ⏹
      </button>
    </>
  ) : (
    !done &&
    !abandoned && (
      <button className="mini-btn timer-btn" onClick={onStartTimer} title="开始计时">
        ▶
      </button>
    )
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={onContextMenu}
      className={`task-card ${done ? 'done' : ''} ${abandoned ? 'abandoned' : ''} ${
        conflict ? 'conflict' : ''
      } ${isRoomy ? 'roomy' : 'compact'}`}
      title={task.title}
    >
      <div className="task-card-row">
        <span className="task-priority-bar" style={{ background: taskColor(task) }} />
        <button
          className={`check ${done ? 'checked' : ''}`}
          onClick={toggleDone}
          aria-label="完成"
        >
          {done ? '✓' : ''}
        </button>
        <span className="task-title">{task.title}</span>
        {/* compact：时间 / 冲突 / 重复 / 用时直接并排于标题行，保持单行紧凑 */}
        {!isRoomy && timeLabel && <span className="task-time">{timeLabel}</span>}
        {!isRoomy && conflict && (
          <span className="conflict-mark" title="时间冲突">
            ⚠
          </span>
        )}
        {!isRoomy && task.repeat && (
          <span className="repeat-mark" title="重复任务">
            ↻
          </span>
        )}
        {!isRoomy && task.durationSec != null && !isTiming && (
          <span className="duration-mark" title="完成用时">
            {formatDurationMinutes(task.durationSec)}
          </span>
        )}
        {timerControls}
      </div>

      {/* roomy：额外元信息行（时间 + 分类色点 + 冲突/重复/用时），标题换行后仍可读 */}
      {isRoomy && (
        <div className="task-meta">
          {timeLabel && <span className="task-time">{timeLabel}</span>}
          {category && (
            <span className="task-category">
              <span className="task-category-dot" style={{ background: taskColor(task) }} />
              {category}
            </span>
          )}
          {conflict && (
            <span className="conflict-mark" title="时间冲突">
              ⚠
            </span>
          )}
          {task.repeat && (
            <span className="repeat-mark" title="重复任务">
              ↻
            </span>
          )}
          {task.durationSec != null && !isTiming && (
            <span className="duration-mark" title="完成用时">
              {formatDurationMinutes(task.durationSec)}
            </span>
          )}
        </div>
      )}
      {note && <div className="task-note">{note}</div>}
    </div>
  )
}
