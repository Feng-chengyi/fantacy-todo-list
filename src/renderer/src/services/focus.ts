/**
 * 专注计时统一提交逻辑：
 * - commitFocus：结束当前计时并按需落库（<MIN_FOCUS_RECORD_SEC 忽略），全端唯一结束路径
 *   （任务卡勾选/⏹、计时面板结束、编辑弹窗停止、切换任务前提交）——保证 Bug 1 的
 *   「切换任务不丢上一任务时长」与 5 秒下限在所有入口一致生效。
 * - recordSession：走单条 IPC focus:commit，主进程一次 setData 原子写入
 *   「session 追加 + 任务 durationSec 累加」，杜绝双写中途失败漂移（QA O1）。
 * - switchTimer：先提交旧计时再开新计时（QA Bug 1）。
 */
import { shouldRecordFocus } from '../../../shared/focus'
import { INBOX_ID } from '../../../shared/collections'
import { newId } from '../lib/id'
import { useTaskStore } from '../stores/taskStore'
import { timerElapsedMs, useUiStore } from '../stores/uiStore'
import * as api from './ipc'

/**
 * 记录一条专注会话（主进程原子提交后本地回放）。
 * 低于专注下限的会话直接忽略（番茄钟极短专注同样不计入）。
 */
export async function recordSession(session: {
  id: string
  taskId: string
  startedAt: string
  endedAt: string
  durationSec: number
  occurrenceDate?: string | null
}): Promise<void> {
  if (!shouldRecordFocus(session.durationSec)) return
  const { task } = await api.commitFocusSession(session)
  useTaskStore.getState().applyCommit(task, session)
}

/**
 * 结束当前计时并按需落库。
 * @returns 是否记录了一条有效专注会话（false = 时长不足被忽略，或本无计时）
 */
export async function commitFocus(): Promise<boolean> {
  const { timer, stopTimer } = useUiStore.getState()
  if (!timer) return false

  const seconds = Math.max(0, Math.round(timerElapsedMs(timer) / 1000))
  // 专注记录下限：低于下限的计时不写任务用时、不记会话
  if (!shouldRecordFocus(seconds)) {
    stopTimer()
    void api.notifyPetAnim({ anim: 'timing', active: false })
    return false
  }

  await recordSession({
    id: newId(),
    taskId: timer.taskId,
    startedAt: new Date(timer.beginAt).toISOString(),
    endedAt: new Date().toISOString(),
    durationSec: seconds,
    occurrenceDate: timer.occurrenceDate ?? null,
  })
  stopTimer()
  void api.notifyPetAnim({ anim: 'timing', active: false })
  return true
}

/**
 * 切换计时的唯一入口：先提交上一个任务的计时（不丢时长），再开始新计时。
 * 任务仓库行 ▶ / 编辑弹窗「开始计时」均使用。
 * occurrenceDate：重复任务的实例日期（日期隔离）；非重复任务传 null。
 */
export async function switchTimer(taskId: string, occurrenceDate: string | null = null): Promise<void> {
  await commitFocus()
  useUiStore.getState().startTimer(taskId, occurrenceDate)
  void api.notifyPetAnim({ anim: 'timing', active: true })
}

/**
 * v3 快捷计时（兜底场景）：不新建正式任务时，在收集箱生成一条临时任务并直接开表。
 */
export async function quickTimer(): Promise<void> {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const { createTask } = useTaskStore.getState()
  const task = await createTask({
    title: `快捷计时 ${hh}:${mm}`,
    priority: 'medium',
    date: null,
    taskType: 'normal',
    collectionId: INBOX_ID,
  })
  await switchTimer(task.id, null)
}
