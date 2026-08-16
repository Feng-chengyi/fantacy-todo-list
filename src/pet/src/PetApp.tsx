/**
 * 桌宠窗口根组件：精灵帧动画（Codex 宠物 v2 规范）、点击 / 拖拽（主进程轮询
 * 绝对定位，DIP 口径精确同步）、滚轮缩放（0.3–1.6 钳制）、右键菜单、鼠标穿透、
 * 气泡 / 番茄徽标与联动动画（timing / finishing / jumping 经 pet:notify-anim 推送）。
 *
 * 鼠标穿透策略：窗口默认穿透（setIgnoreMouse(true)）；指针悬停到热区 / 菜单时捕获，
 * 离开后恢复穿透。右键菜单打开期间强制捕获，避免「菜单按钮点不到、疑似死机」。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'
import type { PetGoal, PetCharacterId, PomodoroState, TodayTodo } from '../../shared/types'
import { PET_CHARACTERS, isPetCharacterId } from '../../shared/defaults'
import { pomodoroPhaseLabel } from '../../shared/pomodoro'
import { Bubble } from './bubble'
import { PomodoroBadge } from './PomodoroBadge'
import { TodayOverlay } from './TodayOverlay'
import { firePetConfetti } from './confetti'
import { SpritePetStage } from './sprite/SpritePetStage'
import { usePetAnimState } from './sprite/usePetAnimState'
import {
  DEFAULT_PET_HIT_BOX,
  DRAG_THRESHOLD,
  clampScale,
  computeHitBox,
  type PetHitBox,
} from './sprite/pet-geometry'

interface MenuState {
  x: number
  y: number
}

interface DragState {
  down: boolean
  moved: boolean
  /** 已进入主进程轮询拖拽（beginDrag 已调用） */
  dragging: boolean
  lastX: number
  lastY: number
}

/** 右键菜单固定尺寸 + 与窗口边缘的安全间距（用于位置钳制，避免菜单溢出窗口） */
const MENU_WIDTH = 220
const MENU_HEIGHT = 400
const MENU_MARGIN = 4

/** 将菜单位置钳制在窗口可视范围内 */
function clampMenuPosition(x: number, y: number): { x: number; y: number } {
  const maxX = Math.max(MENU_MARGIN, window.innerWidth - MENU_WIDTH - MENU_MARGIN)
  const maxY = Math.max(MENU_MARGIN, window.innerHeight - MENU_HEIGHT - MENU_MARGIN)
  return {
    x: Math.min(Math.max(x, MENU_MARGIN), maxX),
    y: Math.min(Math.max(y, MENU_MARGIN), maxY),
  }
}

export function PetApp() {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const scaleRef = useRef(1)
  // 拖拽阈值判定用 client 坐标（与 DPI / 多显示器无关；旧版 screenX 在高 DPI
  // 下与主进程 DIP 口径不一致，是拖拽图像错位的根因之一）
  const dragRef = useRef<DragState>({ down: false, moved: false, dragging: false, lastX: 0, lastY: 0 })
  const menuOpenRef = useRef(false)
  const confettiRef = useRef(true)

  const [characterId, setCharacterId] = useState<PetCharacterId>('bubcat')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [showRoles, setShowRoles] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null)
  const [todos, setTodos] = useState<TodayTodo[]>([])
  const [goals, setGoals] = useState<PetGoal[]>([])
  const [hovering, setHovering] = useState(false)
  const [hitBox, setHitBox] = useState<PetHitBox>(DEFAULT_PET_HIT_BOX)

  // 联动动画状态机（一次性动画 > timing > running > idle）；回调均为稳定引用
  const { anim: petAnim, restartKey, trigger, setTiming, setRunning, handleFinish } = usePetAnimState()

  /** 浮层离开隐藏计时器：给鼠标从角色移动到浮层留出过渡时间 */
  const hideTimerRef = useRef<number | null>(null)

  /** 统一的鼠标穿透开关：interactive=true 表示捕获鼠标 */
  const setPetInteractive = useCallback((interactive: boolean) => {
    void window.petApi.setIgnoreMouse(!interactive)
  }, [])

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    cancelHide()
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null
      setHovering(false)
      setPetInteractive(false)
    }, 150)
  }, [cancelHide, setPetInteractive])

  const closeMenu = useCallback(() => {
    setMenu(null)
    setShowRoles(false)
    menuOpenRef.current = false
    setPetInteractive(false)
  }, [setPetInteractive])

  const openMenu = useCallback(
    (x: number, y: number) => {
      menuOpenRef.current = true
      setShowRoles(false)
      setMenu({ x, y })
      setPetInteractive(true)
    },
    [setPetInteractive],
  )

  const switchCharacter = useCallback(
    (id: PetCharacterId) => {
      closeMenu()
      if (id === characterId) return
      setCharacterId(id)
      void window.petApi.setConfig({ selectedCharacter: id })
    },
    [characterId, closeMenu],
  )

  // 点击随机动作：挥手招呼
  const playRandom = useCallback(() => {
    trigger('waving')
  }, [trigger])

  // 完成待办后的庆祝反馈：finishing 动画 + 撒花 + 鼓励文案气泡
  const celebrate = useCallback(() => {
    trigger('finishing')
    const phrases = ['太棒了！', '真厉害！', '又完成一件！', '继续保持！', '好样的！']
    setBubble(phrases[Math.floor(Math.random() * phrases.length)])
    window.setTimeout(() => setBubble(null), 3000)
    if (confettiRef.current) firePetConfetti()
  }, [trigger])

  // 初始化：读配置（角色 / 缩放）、订阅气泡 / 番茄 / 联动动画 / 今日待办、默认鼠标穿透
  useEffect(() => {
    let disposed = false
    void window.petApi.getConfig().then((cfg) => {
      if (disposed) return
      scaleRef.current = clampScale(cfg.petScale ?? 1)
      confettiRef.current = cfg.confettiEnabled !== false
      const target: PetCharacterId = isPetCharacterId(cfg.selectedCharacter) ? cfg.selectedCharacter : 'bubcat'
      setCharacterId((current) => (current === target ? current : target))
      setHitBox(computeHitBox(scaleRef.current))
    })
    const offBubble = window.petApi.onBubble((text) => {
      setBubble(text)
      window.setTimeout(() => setBubble(null), 4000)
    })
    const offPomodoro = window.petApi.onPomodoro((state) => setPomodoro(state))
    // 主窗口联动动画：timing（正向计时）/ finishing（任务完成）/ jumping（番茄完成）
    const offAnim = window.petApi.onAnim((notice) => {
      if (notice.anim === 'timing') setTiming(notice.active === true)
      else if (notice.anim === 'finishing') trigger('finishing')
      else if (notice.anim === 'jumping') trigger('jumping')
    })
    const offTodayTodos = window.petApi.onTodayTodos((list) => setTodos(list))
    const offGoals = window.petApi.onGoals((list) => setGoals(list))
    setPetInteractive(false)
    return () => {
      disposed = true
      offBubble()
      offPomodoro()
      offAnim()
      offTodayTodos()
      offGoals()
    }
  }, [setPetInteractive, setTiming, trigger])

  /**
   * window 级拖拽状态机：超过阈值判定为拖拽后，仅向主进程发一次 beginDrag，
   * 之后由主进程 16ms 轮询光标绝对定位窗口（DIP 口径，抓取点锁定零漂移）。
   * 拖拽期间按水平方向播放 running-right / running-left。
   */
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const d = dragRef.current
      if (!d.down || d.dragging) {
        // 拖拽进行中：持续按 clientX 方向更新跑动朝向
        if (d.dragging) {
          const dx = e.clientX - d.lastX
          if (Math.abs(dx) > 1) setRunning(dx > 0 ? 'right' : 'left')
        }
        return
      }
      const dist = Math.abs(e.clientX - d.lastX) + Math.abs(e.clientY - d.lastY)
      if (!d.moved && dist > DRAG_THRESHOLD) {
        d.moved = true
        d.dragging = true
        void window.petApi.beginDrag()
      }
    }
    const endDrag = (): void => {
      const d = dragRef.current
      if (d.dragging) {
        void window.petApi.endDrag()
        setRunning(null)
      }
      if (d.down && !d.moved) playRandom()
      d.down = false
      d.moved = false
      d.dragging = false
    }
    const onBlur = (): void => {
      const d = dragRef.current
      if (d.dragging) {
        void window.petApi.endDrag()
        setRunning(null)
      }
      d.down = false
      d.moved = false
      d.dragging = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', endDrag)
      window.removeEventListener('blur', onBlur)
    }
  }, [playRandom, setRunning])

  // 菜单打开期间：全局监听点击（菜单外即关闭，覆盖透明穿透区）与窗口失焦（点击桌面/其它应用关闭）
  useEffect(() => {
    if (!menu) return
    const onGlobalMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node | null
      if (menuRef.current && target && menuRef.current.contains(target)) return
      closeMenu()
    }
    const onWindowBlur = (): void => closeMenu()
    window.addEventListener('mousedown', onGlobalMouseDown, true)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('mousedown', onGlobalMouseDown, true)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [menu, closeMenu])

  const onMouseDown = (e: ReactMouseEvent): void => {
    if (e.button !== 0) return
    dragRef.current = { down: true, moved: false, dragging: false, lastX: e.clientX, lastY: e.clientY }
  }

  const onWheel = (e: ReactWheelEvent): void => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    // 缩放钳制在 [0.3, 1.6]，防止过大或过小
    scaleRef.current = clampScale(scaleRef.current + delta)
    setHitBox(computeHitBox(scaleRef.current))
    void window.petApi.setConfig({ petScale: scaleRef.current })
  }

  const onContextMenu = (e: ReactMouseEvent): void => {
    e.preventDefault()
    openMenu(e.clientX, e.clientY)
  }

  // 浮层定位：角色上方、水平居中，随 hitBox（scale）动态变化
  const overlayStyle: CSSProperties = {
    left: hitBox.left + hitBox.width / 2,
    top: Math.max(8, hitBox.top - 12),
    transform: 'translate(-50%, -100%)',
  }

  // 菜单实时联动数据
  const nearestGoal = goals.find((g) => g.daysLeft >= 0)
  const pomodoroActive = pomodoro != null && pomodoro.phase !== 'idle'

  const openPanelAndClose = useCallback(
    (panel: Parameters<typeof window.petApi.openPanel>[0]) => {
      void window.petApi.openPanel(panel)
      closeMenu()
    },
    [closeMenu],
  )

  return (
    <div className="pet-root">
      <SpritePetStage
        characterId={characterId}
        scale={scaleRef.current}
        anim={petAnim}
        restartKey={restartKey}
        onAnimFinish={handleFinish}
      />

      {/* 可交互热区：贴合角色轮廓；进入则捕获鼠标，离开则穿透（菜单打开期间不穿透） */}
      <div
        className="pet-hit-area"
        style={{ left: hitBox.left, top: hitBox.top, width: hitBox.width, height: hitBox.height }}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
        onMouseEnter={() => {
          cancelHide()
          setHovering(true)
          setPetInteractive(true)
        }}
        onMouseLeave={() => {
          if (menuOpenRef.current) return
          scheduleHide()
        }}
      />

      {hovering && (
        <TodayOverlay
          todos={todos}
          goals={goals}
          style={overlayStyle}
          onEnter={() => {
            cancelHide()
            setHovering(true)
          }}
          onLeave={() => {
            setHovering(false)
            setPetInteractive(false)
          }}
          onComplete={celebrate}
        />
      )}

      <Bubble text={bubble ?? ''} />
      <PomodoroBadge state={pomodoro} />

      {menu && (
        <div
          ref={menuRef}
          className="pet-menu"
          style={(() => {
            const pos = clampMenuPosition(menu.x, menu.y)
            return { left: pos.x, top: pos.y }
          })()}
          onMouseEnter={() => setPetInteractive(true)}
        >
          {/* 实时联动状态区：数据来自主进程推送，完成待办后数字即时变化 */}
          <button className="pet-menu-info" onClick={() => openPanelAndClose('today')}>
            📋 今日待办 · {todos.length} 项{todos.length > 0 ? '（点击查看）' : '，全部完成 🎉'}
          </button>
          {nearestGoal && (
            <button className="pet-menu-info" onClick={() => openPanelAndClose('goals')}>
              ⏳ {nearestGoal.daysLeft === 0
                ? `『${nearestGoal.title}』就是今天`
                : `距『${nearestGoal.title}』还有 ${nearestGoal.daysLeft} 天`}
            </button>
          )}
          {pomodoroActive && pomodoro && (
            <button className="pet-menu-info" onClick={() => openPanelAndClose('pomodoro')}>
              {pomodoroPhaseLabel(pomodoro.phase)}
            </button>
          )}

          <div className="pet-menu-section">角色</div>
          <button onClick={() => setShowRoles((v) => !v)}>
            切换角色 <span className="pet-menu-arrow">▸</span>
          </button>
          {showRoles && (
            <div className="pet-menu-sub">
              {PET_CHARACTERS.map((m) => (
                <button key={m.id} onClick={() => switchCharacter(m.id)}>
                  <span className="pet-menu-check">{m.id === characterId ? '✓' : ''}</span>
                  {m.name}
                </button>
              ))}
            </div>
          )}

          <div className="pet-menu-section">面板</div>
          <button onClick={() => openPanelAndClose('timer')}>⏱ 计时器</button>
          <button onClick={() => openPanelAndClose('pomodoro')}>番茄钟</button>
          <button onClick={() => openPanelAndClose('stats')}>统计</button>
          <button onClick={() => openPanelAndClose('habits')}>习惯</button>
          <button onClick={() => openPanelAndClose('goals')}>倒数日</button>
          <button onClick={() => openPanelAndClose('settings')}>设置</button>

          <div className="pet-menu-section">应用</div>
          <button onClick={() => openPanelAndClose('today')}>今日待办</button>
          <button
            onClick={() => {
              void window.petApi.setVisible(false)
              closeMenu()
            }}
          >
            隐藏桌宠
          </button>
          <button
            onClick={() => {
              void window.petApi.focusMain()
              closeMenu()
            }}
          >
            显示主窗口
          </button>
          <button
            className="danger"
            onClick={() => {
              void window.petApi.quit()
              closeMenu()
            }}
          >
            退出
          </button>
        </div>
      )}
    </div>
  )
}
