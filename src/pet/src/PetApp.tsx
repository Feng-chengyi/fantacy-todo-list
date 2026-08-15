/**
 * 桌宠窗口根组件：整合 Live2D 渲染、点击 / 拖拽 / 滚轮 / 右键菜单（含切换角色）、
 * 鼠标穿透、气泡与番茄徽标。
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
import type { Live2DModel } from 'pixi-live2d-display'
import type { PetGoal, PetModelId, PomodoroState, TodayTodo } from '../../shared/types'
import { PET_MODELS, isPetModelId } from '../../shared/defaults'
import { Live2DStage } from './Live2DStage'
import { Bubble } from './bubble'
import { PomodoroBadge } from './PomodoroBadge'
import { TodayOverlay } from './TodayOverlay'
import { firePetConfetti } from './confetti'
import {
  DEFAULT_PET_HIT_BOX,
  DRAG_THRESHOLD,
  clampScale,
  computePetHitBox,
  pickTapMotionGroup,
  type PetHitBox,
} from './pet-events'

interface MenuState {
  x: number
  y: number
}

interface DragState {
  down: boolean
  moved: boolean
  lastX: number
  lastY: number
}

/** 右键菜单固定尺寸 + 与窗口边缘的安全间距（用于位置钳制，避免菜单溢出窗口） */
const MENU_WIDTH = 220
const MENU_HEIGHT = 320
const MENU_MARGIN = 4

/** 将菜单位置钳制在窗口可视范围内（固定 220×320 尺寸下最坏情况仍不溢出） */
function clampMenuPosition(x: number, y: number): { x: number; y: number } {
  const maxX = Math.max(MENU_MARGIN, window.innerWidth - MENU_WIDTH - MENU_MARGIN)
  const maxY = Math.max(MENU_MARGIN, window.innerHeight - MENU_HEIGHT - MENU_MARGIN)
  return {
    x: Math.min(Math.max(x, MENU_MARGIN), maxX),
    y: Math.min(Math.max(y, MENU_MARGIN), maxY),
  }
}

export function PetApp() {
  const modelRef = useRef<Live2DModel | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const baseScaleRef = useRef(1)
  const scaleRef = useRef(1)
  const dragRef = useRef<DragState>({ down: false, moved: false, lastX: 0, lastY: 0 })
  const menuOpenRef = useRef(false)
  const confettiRef = useRef(true)

  const [modelId, setModelId] = useState<PetModelId>('haru')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [showRoles, setShowRoles] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null)
  const [todos, setTodos] = useState<TodayTodo[]>([])
  const [goals, setGoals] = useState<PetGoal[]>([])
  const [hovering, setHovering] = useState(false)
  const [hitBox, setHitBox] = useState<PetHitBox>(DEFAULT_PET_HIT_BOX)

  /** 浮层离开隐藏计时器：给鼠标从模型移动到浮层留出过渡时间 */
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

  const onModelReady = useCallback((model: Live2DModel, baseScale: number) => {
    modelRef.current = model
    baseScaleRef.current = baseScale
    model.scale.set(baseScale * scaleRef.current)
    setHitBox(computePetHitBox(model))
  }, [])

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

  const switchModel = useCallback(
    (id: PetModelId) => {
      closeMenu()
      if (id === modelId) return
      // 立即清空旧模型引用，避免切换过程中对已销毁模型触发动作
      modelRef.current = null
      setModelId(id)
      void window.petApi.setConfig({ selectedModel: id })
    },
    [modelId, closeMenu],
  )

  // 点击随机动作：读取模型真实 Motions 分组（优先 TapBody，回退 Idle）
  const playRandom = useCallback(() => {
    const model = modelRef.current
    if (!model) return
    void model.motion(pickTapMotionGroup(model))
  }, [])

  // 完成待办后的庆祝反馈：随机动作 + 撒花 + 鼓励文案气泡
  const celebrate = useCallback(() => {
    playRandom()
    const phrases = ['太棒了！', '真厉害！', '又完成一件！', '继续保持！', '好样的！']
    setBubble(phrases[Math.floor(Math.random() * phrases.length)])
    window.setTimeout(() => setBubble(null), 3000)
    if (confettiRef.current) firePetConfetti()
  }, [playRandom])

  // 初始化：读配置（角色 / 缩放）、订阅气泡 / 番茄 / 今日待办、默认鼠标穿透
  useEffect(() => {
    let disposed = false
    void window.petApi.getConfig().then((cfg) => {
      if (disposed) return
      scaleRef.current = clampScale(cfg.petScale ?? 1)
      confettiRef.current = cfg.confettiEnabled !== false
      const model = modelRef.current
      if (model) {
        model.scale.set(baseScaleRef.current * scaleRef.current)
        setHitBox(computePetHitBox(model))
      }
      const target: PetModelId = isPetModelId(cfg.selectedModel) ? cfg.selectedModel : 'haru'
      setModelId((current) => (current === target ? current : target))
    })
    const offBubble = window.petApi.onBubble((text) => {
      setBubble(text)
      window.setTimeout(() => setBubble(null), 4000)
    })
    const offPomodoro = window.petApi.onPomodoro((state) => setPomodoro(state))
    const offTodayTodos = window.petApi.onTodayTodos((list) => setTodos(list))
    const offGoals = window.petApi.onGoals((list) => setGoals(list))
    setPetInteractive(false)
    return () => {
      disposed = true
      offBubble()
      offPomodoro()
      offTodayTodos()
      offGoals()
    }
  }, [setPetInteractive])

  // window 级 mousemove/mouseup：拖拽移窗（拖出热区仍可继续）
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const d = dragRef.current
      if (!d.down) return
      const dx = e.screenX - d.lastX
      const dy = e.screenY - d.lastY
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) d.moved = true
      if (d.moved) {
        d.lastX = e.screenX
        d.lastY = e.screenY
        void window.petApi.moveWindow(dx, dy)
      }
    }
    const onUp = (): void => {
      const d = dragRef.current
      if (d.down && !d.moved) playRandom()
      d.down = false
      d.moved = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [playRandom])

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
    dragRef.current = { down: true, moved: false, lastX: e.screenX, lastY: e.screenY }
  }

  const onWheel = (e: ReactWheelEvent): void => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    scaleRef.current = clampScale(scaleRef.current + delta)
    const model = modelRef.current
    if (model) {
      model.scale.set(baseScaleRef.current * scaleRef.current)
      setHitBox(computePetHitBox(model))
    }
    void window.petApi.setConfig({ petScale: scaleRef.current })
  }

  const onContextMenu = (e: ReactMouseEvent): void => {
    e.preventDefault()
    openMenu(e.clientX, e.clientY)
  }

  // 浮层定位：模型上方、水平居中，随 hitBox（scale）动态变化
  const overlayStyle: CSSProperties = {
    left: hitBox.left + hitBox.width / 2,
    top: Math.max(8, hitBox.top - 12),
    transform: 'translate(-50%, -100%)',
  }

  return (
    <div className="pet-root">
      <Live2DStage modelId={modelId} onModelReady={onModelReady} />

      {/* 可交互热区：贴合模型轮廓；进入则捕获鼠标，离开则穿透（菜单打开期间不穿透） */}
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
          <button onClick={() => setShowRoles((v) => !v)}>
            切换角色 <span className="pet-menu-arrow">▸</span>
          </button>
          {showRoles && (
            <div className="pet-menu-sub">
              {PET_MODELS.map((m) => (
                <button key={m.id} onClick={() => switchModel(m.id)}>
                  <span className="pet-menu-check">{m.id === modelId ? '✓' : ''}</span>
                  {m.name}
                </button>
              ))}
            </div>
          )}
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
            onClick={() => {
              void window.petApi.openPanel('today')
              closeMenu()
            }}
          >
            今日待办
          </button>
          <button
            onClick={() => {
              void window.petApi.openPanel('stats')
              closeMenu()
            }}
          >
            统计
          </button>
          <button
            onClick={() => {
              void window.petApi.openPanel('habits')
              closeMenu()
            }}
          >
            习惯
          </button>
          <button
            onClick={() => {
              void window.petApi.openPanel('goals')
              closeMenu()
            }}
          >
            倒数日
          </button>
          <button
            onClick={() => {
              void window.petApi.openPanel('pomodoro')
              closeMenu()
            }}
          >
            番茄钟
          </button>
          <button
            onClick={() => {
              void window.petApi.openPanel('settings')
              closeMenu()
            }}
          >
            设置
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
