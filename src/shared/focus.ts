/**
 * 专注计时（正向计时 / 番茄钟）领域纯函数：
 * - shouldRecordFocus：专注记录下限（< MIN_FOCUS_RECORD_SEC 不落库）
 * - applyFocusCommit：单写者一次原子提交（追加会话 + 累加任务 durationSec），
 *   消除「双写 IPC 中途失败导致 durationSec 与 sessions 漂移」的风险
 * - buildPomodoroSession：番茄专注阶段完成 → 会话记录
 * - shouldAutoplayBgm：BGM 自动播放决策（仅计时开始且用户未手动暂停）
 * - selectTimerCandidates：计时面板候选任务（全部 pending，按日期升序、收集箱殿后）
 */
import { MIN_FOCUS_RECORD_SEC } from './defaults'
import type { FocusSession, FullData, Task, TimerState } from './types'

/** 时长是否达到专注记录下限（≥ 下限才计入统计） */
export function shouldRecordFocus(elapsedSec: number): boolean {
  return elapsedSec >= MIN_FOCUS_RECORD_SEC
}

/** 计算当前已计时的毫秒数（纯函数，供各处展示复用） */
export function timerElapsedMs(t: TimerState): number {
  return t.accumMs + (t.paused ? 0 : Date.now() - t.startedAt)
}

/**
 * 判断某计时实例是否属于「指定任务 + 指定日期」（重复计时日期隔离用）。
 * 非重复任务 occurrenceDate 为 null，与 date=null 等价比较。
 */
export function isSameTimerInstance(timer: TimerState, taskId: string, date: string | null): boolean {
  return timer.taskId === taskId && (timer.occurrenceDate ?? null) === (date ?? null)
}

/**
 * 原子应用一次专注提交：sessions 追加该会话；若绑定任务存在则其 durationSec 累加。
 * 返回新的 FullData（不修改入参）。
 */
export function applyFocusCommit(data: FullData, session: FocusSession): FullData {
  const tasks = session.taskId
    ? data.tasks.map((t) =>
        t.id === session.taskId
          ? { ...t, durationSec: (t.durationSec ?? 0) + session.durationSec }
          : t,
      )
    : data.tasks
  return { ...data, tasks, sessions: [...data.sessions, session] }
}

/**
 * 番茄专注阶段自然完成（倒数到 0）→ 生成一条自由计时会话。
 * startedAt 由结束时刻回推总时长，保证统计区间归属正确。
 */
export function buildPomodoroSession(totalSeconds: number, endedAtMs: number): FocusSession {
  const startedAtMs = endedAtMs - totalSeconds * 1000
  return {
    id: `pomodoro-${endedAtMs}`,
    taskId: '',
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationSec: totalSeconds,
    occurrenceDate: null,
  }
}

/** BGM 自动播放决策：需同时满足「开启自动播放、未手动暂停、已加载音乐」 */
export function shouldAutoplayBgm(opts: {
  autoplay: boolean
  userPaused: boolean
  bgmLoaded: boolean
}): boolean {
  return opts.autoplay && !opts.userPaused && opts.bgmLoaded
}

/**
 * 计时面板候选任务：全部 pending 任务（不限今日），按日期升序，收集箱殿后，
 * 同日期内按标题排序，保证下拉顺序稳定。
 */
export function selectTimerCandidates(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => {
      if (a.date === null && b.date === null) return a.title.localeCompare(b.title, 'zh')
      if (a.date === null) return 1
      if (b.date === null) return -1
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      return a.title.localeCompare(b.title, 'zh')
    })
}
