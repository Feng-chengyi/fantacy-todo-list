/**
 * 统一计时器面板（主视图面板）：
 * - 顶部「正向计时 / 番茄钟」两模式切换（uiStore.timerMode）。
 * - 翻页/电子时钟、背景图、BGM、励志文案、遮罩、「返回日历」两模式共用，仅显示数字来源不同。
 * - 正向计时：任务绑定计时（任务卡 ▶ 定向至此自动开始）、暂停/继续/结束（结束走 commitFocus）。
 * - 番茄钟：读 pomodoroStore（status/phase/remaining/total/start/pause/reset/skip/init），
 *   挂载时 init(focus, break)，渲染阶段标签 + 进度条 + 开始/暂停/重置/跳过；不显示「计时对象」下拉。
 * - BGM 自动播放监听统一「运行中」信号（正向 = 未暂停进行中；番茄 = status running）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_TIMER_QUOTES } from '../../../../shared/defaults'
import { formatHms } from '../../../../shared/time'
import type { Task } from '../../../../shared/types'
import { selectTimerCandidates, shouldAutoplayBgm } from '../../../../shared/focus'
import * as api from '../../services/ipc'
import { commitFocus, switchTimer } from '../../services/focus'
import { useConfigStore } from '../../stores/configStore'
import { usePomodoroStore } from '../../stores/pomodoroStore'
import { useTaskStore } from '../../stores/taskStore'
import { timerElapsedMs, useUiStore } from '../../stores/uiStore'
import { FlipClock } from './FlipClock'

export function TimerPanel() {
  const timer = useUiStore((s) => s.timer)
  const timerMode = useUiStore((s) => s.timerMode)
  const setTimerMode = useUiStore((s) => s.setTimerMode)
  const pauseTimer = useUiStore((s) => s.pauseTimer)
  const resumeTimer = useUiStore((s) => s.resumeTimer)
  const setPage = useUiStore((s) => s.setPage)
  const tasks = useTaskStore((s) => s.tasks)

  // 番茄钟 store
  const pomodoroStatus = usePomodoroStore((s) => s.status)
  const pomodoroPhase = usePomodoroStore((s) => s.phase)
  const pomodoroRemainingSeconds = usePomodoroStore((s) => s.remainingSeconds)
  const pomodoroTotalSeconds = usePomodoroStore((s) => s.totalSeconds)
  const pomodoroStart = usePomodoroStore((s) => s.start)
  const pomodoroPause = usePomodoroStore((s) => s.pause)
  const pomodoroReset = usePomodoroStore((s) => s.reset)
  const pomodoroSkip = usePomodoroStore((s) => s.skip)
  const pomodoroInit = usePomodoroStore((s) => s.init)

  const timerBgmVolume = useConfigStore((s) => s.timerBgmVolume ?? 0.6)
  const timerBgmAutoplay = useConfigStore((s) => s.timerBgmAutoplay === true)
  const timerDim = useConfigStore((s) => s.timerDim ?? 0.35)
  const timerClockStyle = useConfigStore((s) => s.timerClockStyle ?? 'digital')
  const timerQuotes = useConfigStore((s) => s.timerQuotes ?? [])
  const focusMinutes = useConfigStore((s) => s.pomodoroFocusMinutes)
  const breakMinutes = useConfigStore((s) => s.pomodoroBreakMinutes)
  const updateConfig = useConfigStore((s) => s.update)

  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [bgmUrl, setBgmUrl] = useState<string | null>(null)
  const [bgmPlaying, setBgmPlaying] = useState(false)
  const [bgmUserPaused, setBgmUserPaused] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * DEFAULT_TIMER_QUOTES.length))
  const [editingQuotes, setEditingQuotes] = useState(false)
  const [quoteDraft, setQuoteDraft] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 可选任务：全部 pending 任务（不限今日），按日期升序、收集箱殿后（QA O6）
  const candidates = useMemo(() => selectTimerCandidates(tasks), [tasks])

  const boundTask = timer?.taskId ? tasks.find((t) => t.id === timer.taskId) : undefined
  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : undefined

  // 统一「运行中」信号（两模式共用，驱动 BGM 自动播放判定）
  const running = timerMode === 'pomodoro' ? pomodoroStatus === 'running' : (!!timer && !timer.paused)

  // 文案池：自定义库非空则优先，否则内置池
  const quotePool = timerQuotes.length > 0 ? timerQuotes : DEFAULT_TIMER_QUOTES
  const quote = quotePool[quoteIdx % quotePool.length] ?? ''

  // 挂载时恢复已保存的背景/BGM（data URL）
  useEffect(() => {
    let disposed = false
    void api.timerLoadAssets().then((assets) => {
      if (disposed) return
      setBgUrl(assets.bgUrl)
      setBgmUrl(assets.bgmUrl)
    })
    return () => {
      disposed = true
    }
  }, [])

  // 番茄钟：配置变化时同步时长（运行中不打断，由 pomodoroStore.init 保证）
  useEffect(() => {
    pomodoroInit(focusMinutes, breakMinutes)
  }, [focusMinutes, breakMinutes, pomodoroInit])

  // 正向计时每秒走时（暂停时冻结）；番茄钟模式不启动此 interval（剩余秒数由 store 驱动）
  useEffect(() => {
    if (timerMode !== 'stopwatch') return
    if (!timer) {
      setElapsedSec(0)
      return
    }
    const tick = (): void => setElapsedSec(Math.floor(timerElapsedMs(timer) / 1000))
    tick()
    if (timer.paused) return
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [timerMode, timer])

  // 音量同步到 <audio>
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = timerBgmVolume
  }, [timerBgmVolume, bgmUrl])

  // 运行中时自动播放 BGM：需同时满足「开启自动播放、用户未手动暂停、音乐已加载」（QA O5）
  useEffect(() => {
    if (!running) return
    const bgmLoaded = !!bgmUrl && !!audioRef.current
    if (shouldAutoplayBgm({ autoplay: timerBgmAutoplay, userPaused: bgmUserPaused, bgmLoaded })) {
      void audioRef.current!.play().catch(() => setBgmPlaying(false))
      setBgmPlaying(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, bgmUserPaused])

  // 正向计时结束后重置「用户手动暂停」标记：新一轮计时恢复自动播放资格（QA O5）
  useEffect(() => {
    if (!timer) setBgmUserPaused(false)
  }, [timer])

  const onBegin = (): void => {
    // 统一切换入口：先提交旧计时（≥5 秒落库），再开新计时（QA Bug 1）。
    // 重复任务保持任务级（occurrenceDate=null，避免全实例同步，设计 §7.8）；
    // 非重复任务用其日期，对齐任务仓库行 / 右键菜单 / 编辑弹窗的实例识别口径。
    const occurrenceDate = selectedTask?.repeat ? null : (selectedTask?.date ?? null)
    void switchTimer(selectedTaskId, occurrenceDate)
  }

  const onFinish = (): void => {
    // 统一结束路径：≥5 秒落库（durationSec + FocusSession），不足则忽略
    void commitFocus()
  }

  const onPomodoroReset = (): void => {
    pomodoroReset()
    // 重置后新一轮番茄可恢复 BGM 自动播放资格
    setBgmUserPaused(false)
  }

  const pickAsset = async (kind: 'bg' | 'bgm'): Promise<void> => {
    const res = await api.timerPickAsset(kind)
    if (res.canceled) return
    if (kind === 'bg') setBgUrl(res.dataUrl ?? null)
    else {
      setBgmUrl(res.dataUrl ?? null)
      setBgmPlaying(false)
      setBgmUserPaused(false)
    }
  }

  const clearAsset = async (kind: 'bg' | 'bgm'): Promise<void> => {
    await api.timerClearAsset(kind)
    if (kind === 'bg') setBgUrl(null)
    else {
      setBgmPlaying(false)
      setBgmUserPaused(false)
      setBgmUrl(null)
    }
  }

  const toggleBgm = (): void => {
    const audio = audioRef.current
    if (!audio || !bgmUrl) return
    if (bgmPlaying) {
      audio.pause()
      setBgmPlaying(false)
      // 用户手动暂停：本次计时内不再被自动播放覆盖（QA O5）
      setBgmUserPaused(true)
    } else {
      void audio.play().catch(() => setBgmPlaying(false))
      setBgmPlaying(true)
      setBgmUserPaused(false)
    }
  }

  const shuffleQuote = (): void => {
    setQuoteIdx((prev) => {
      if (quotePool.length <= 1) return prev
      let next = prev
      while (next === prev) next = Math.floor(Math.random() * quotePool.length)
      return next
    })
  }

  const openQuoteEditor = (): void => {
    setQuoteDraft(timerQuotes.join('\n'))
    setEditingQuotes(true)
  }

  const saveQuotes = (): void => {
    const lines = quoteDraft
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    void updateConfig({ timerQuotes: lines })
    setEditingQuotes(false)
    setQuoteIdx(lines.length > 0 ? Math.floor(Math.random() * lines.length) : 0)
  }

  // 显示数字来源：番茄钟 = 剩余秒（倒计时），正向计时 = 已计时秒（正计时）
  const displaySeconds = timerMode === 'pomodoro' ? pomodoroRemainingSeconds : elapsedSec

  const pomodoroRunning = pomodoroStatus === 'running'
  const pomodoroProgress = pomodoroTotalSeconds > 0 ? (pomodoroRemainingSeconds / pomodoroTotalSeconds) * 100 : 0
  const pomodoroEmoji = pomodoroPhase === 'focus' ? '🍅' : '☕'
  const pomodoroLabel = pomodoroPhase === 'focus' ? '专注中' : '休息中'

  return (
    <div className="timer-panel" style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}>
      {bgUrl && <div className="timer-panel-dim" style={{ opacity: timerDim }} />}
      <div className="timer-panel-content">
        <div className="timer-panel-head">
          <h2>{timerMode === 'pomodoro' ? '番茄钟' : '正向计时器'}</h2>
          <button className="text-btn" onClick={() => setPage('todo')}>
            返回待办
          </button>
        </div>

        {/* 模式切换 */}
        <div className="timer-mode-tabs">
          <button
            className={timerMode === 'stopwatch' ? 'active' : ''}
            onClick={() => setTimerMode('stopwatch')}
          >
            正向计时
          </button>
          <button
            className={timerMode === 'pomodoro' ? 'active' : ''}
            onClick={() => setTimerMode('pomodoro')}
          >
            番茄钟
          </button>
        </div>

        {/* 计时对象下拉：仅正向计时模式 */}
        {timerMode === 'stopwatch' && (
          <div className="timer-task-select">
            <label>
              <span style={{ color: 'var(--text-muted)' }}>计时对象</span>
              <select
                className="input"
                value={timer ? timer.taskId : selectedTaskId}
                disabled={!!timer}
                onChange={(e) => setSelectedTaskId(e.target.value)}
              >
                <option value="">自由计时（不绑定任务）</option>
                {candidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.date === null ? '[收集箱] ' : `[${t.date}] `}
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {timerClockStyle === 'flip' ? (
          <FlipClock seconds={displaySeconds} />
        ) : (
          <div className="timer-display">{formatHms(displaySeconds)}</div>
        )}
        <div className="timer-task-title">
          {timerMode === 'pomodoro'
            ? `${pomodoroEmoji} ${pomodoroLabel}`
            : timer
              ? (boundTask ? boundTask.title : '自由计时') + (timer.paused ? '（已暂停）' : '')
              : '未开始'}
        </div>

        {/* 番茄钟进度条 */}
        {timerMode === 'pomodoro' && (
          <div className="progress-track" style={{ background: 'var(--bg)' }}>
            <div
              className="progress-fill"
              style={{ width: `${pomodoroProgress}%`, background: 'var(--accent)' }}
            />
          </div>
        )}

        {/* 励志文案区：换一句 / 编辑自定义文案库 */}
        {quote && (
          <div className="timer-quote">
            <p>{quote}</p>
            <div className="timer-quote-actions">
              <button className="ghost-btn" onClick={shuffleQuote}>
                换一句
              </button>
              <button className="ghost-btn" onClick={openQuoteEditor}>
                编辑文案
              </button>
            </div>
          </div>
        )}
        {editingQuotes && (
          <div className="timer-quote-editor">
            <textarea
              rows={5}
              placeholder={'每行一条文案；留空保存则恢复使用内置文案池'}
              value={quoteDraft}
              onChange={(e) => setQuoteDraft(e.target.value)}
            />
            <div className="timer-quote-editor-actions">
              <button className="primary-btn" onClick={saveQuotes}>
                保存
              </button>
              <button className="ghost-btn" onClick={() => setEditingQuotes(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        <div className="timer-controls">
          {timerMode === 'pomodoro' ? (
            <>
              {pomodoroRunning ? (
                <button className="primary-btn" onClick={pomodoroPause}>
                  暂停
                </button>
              ) : (
                <button className="primary-btn" onClick={pomodoroStart}>
                  开始
                </button>
              )}
              <button className="ghost-btn" onClick={onPomodoroReset}>
                重置
              </button>
              <button className="ghost-btn" onClick={pomodoroSkip}>
                跳过
              </button>
            </>
          ) : !timer ? (
            <button className="primary-btn" onClick={onBegin}>
              开始计时
            </button>
          ) : timer.paused ? (
            <>
              <button className="primary-btn" onClick={resumeTimer}>
                继续
              </button>
              <button className="ghost-btn" onClick={onFinish}>
                结束并记录
              </button>
            </>
          ) : (
            <>
              <button className="ghost-btn" onClick={pauseTimer}>
                暂停
              </button>
              <button className="ghost-btn" onClick={onFinish}>
                结束并记录
              </button>
            </>
          )}
        </div>
        {timerMode === 'stopwatch' && timer && timer.taskId && boundTask?.durationSec != null && (
          <div className="timer-accum">
            该任务已累计用时 {Math.round(boundTask.durationSec / 60)} 分钟
          </div>
        )}

        <div className="timer-customize">
          <div className="timer-customize-row">
            <span className="timer-customize-label">时钟风格</span>
            <button
              className={`ghost-btn ${timerClockStyle === 'flip' ? 'clock-style-active' : ''}`}
              onClick={() => void updateConfig({ timerClockStyle: 'flip' })}
            >
              翻页时钟
            </button>
            <button
              className={`ghost-btn ${timerClockStyle === 'digital' ? 'clock-style-active' : ''}`}
              onClick={() => void updateConfig({ timerClockStyle: 'digital' })}
            >
              电子时钟
            </button>
          </div>
          <div className="timer-customize-row">
            <span className="timer-customize-label">背景图片</span>
            <button className="ghost-btn" onClick={() => void pickAsset('bg')}>
              选择图片
            </button>
            {bgUrl && (
              <button className="ghost-btn" onClick={() => void clearAsset('bg')}>
                清除
              </button>
            )}
          </div>
          {bgUrl && (
            <div className="timer-customize-row">
              <span className="timer-customize-label">背景遮罩</span>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={timerDim}
                onChange={(e) => void updateConfig({ timerDim: Number(e.target.value) })}
              />
            </div>
          )}
          <div className="timer-customize-row">
            <span className="timer-customize-label">背景音乐</span>
            <button className="ghost-btn" onClick={() => void pickAsset('bgm')}>
              选择音乐
            </button>
            {bgmUrl && (
              <>
                <button className="ghost-btn" onClick={toggleBgm}>
                  {bgmPlaying ? '暂停' : '播放'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={timerBgmVolume}
                  title="音量"
                  onChange={(e) => void updateConfig({ timerBgmVolume: Number(e.target.value) })}
                />
                <button className="ghost-btn" onClick={() => void clearAsset('bgm')}>
                  清除
                </button>
              </>
            )}
          </div>
          <label className="timer-customize-row timer-autoplay">
            <input
              type="checkbox"
              checked={timerBgmAutoplay}
              onChange={(e) => void updateConfig({ timerBgmAutoplay: e.target.checked })}
            />
            <span>计时开始时自动播放音乐（循环）</span>
          </label>
        </div>
      </div>

      {bgmUrl && <audio ref={audioRef} src={bgmUrl} loop preload="auto" />}
    </div>
  )
}
