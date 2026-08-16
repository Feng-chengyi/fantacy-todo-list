/**
 * 桌宠窗口根组件：精灵帧动画（Codex 宠物 v2 规范）、点击 / 拖拽（主进程轮询
 * 绝对定位，DIP 口径精确同步）、滚轮缩放（0.3–1.6 钳制）、右键菜单、鼠标穿透、
 * 气泡 / 番茄徽标与联动动画（timing / finishing / jumping 经 pet:notify-anim 推送）。
 *
 * 动态窗口尺寸：角色帧尺寸（manifest.frame）+ 缩放 → computePetWindowSize 上报
 * 主进程（pet:set-size）；角色切换 / 缩放 / 自定义宠物加载后自动上报。
 *
 * 屏幕感知偏移：右键菜单 / 浮层 / 气泡经 getWorkArea() + screenAwareOffset 在
 * 屏幕边缘自动平移，保证完全可见；桌宠本体不钳制（全屏自由移动）。
 *
 * 鼠标穿透策略：窗口默认穿透（setIgnoreMouse(true)）；指针悬停到热区 / 菜单时捕获，
 * 离开后恢复穿透。右键菜单打开期间强制捕获，避免「菜单按钮点不到、疑似死机」。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'
import type {
  PetGoal,
  PetCharacterId,
  PomodoroState,
  TodayTodo,
  WorkAreaRect,
} from '../../shared/types'
import { PET_CHARACTERS } from '../../shared/defaults'
import { pomodoroPhaseLabel } from '../../shared/pomodoro'
import { computePetWindowSize, screenAwareOffset } from '../../shared/petWindow'
import { Bubble } from './bubble'
import { PomodoroBadge } from './PomodoroBadge'
import { TodayOverlay } from './TodayOverlay'
import { firePetConfetti } from './confetti'
import { SpritePetStage } from './sprite/SpritePetStage'
import { usePetAnimState } from './sprite/usePetAnimState'
import { getPetAssets, getPetName, loadCustomPets, type CustomPetInfo } from './sprite/petAssets'
import { DRAG_THRESHOLD, clampScale, computeHitBox } from './sprite/pet-geometry'

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

/** 屏幕感知平移：元素局部矩形 + 窗口屏幕坐标 → 工作区内平移量（无工作区时零偏移） */
function screenAware(
  local: { x: number; y: number; width: number; height: number },
  workArea: WorkAreaRect | null,
): { dx: number; dy: number } {
  if (!workArea) return { dx: 0, dy: 0 }
  return screenAwareOffset(local, { x: window.screenX, y: window.screenY }, workArea)
}

export function PetApp() {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  // 拖拽阈值判定用 client 坐标（与 DPI / 多显示器无关；旧版 screenX 在高 DPI
  // 下与主进程 DIP 口径不一致，是拖拽图像错位的根因之一）
  const dragRef = useRef<DragState>({ down: false, moved: false, dragging: false, lastX: 0, lastY: 0 })
  const menuOpenRef = useRef(false)
  const confettiRef = useRef(true)
  const workAreaRef = useRef<WorkAreaRect | null>(null)

  const [characterId, setCharacterId] = useState<PetCharacterId>('bubcat')
  /** 已加载的自定义宠物（id + 显示名，切换菜单「自定义」组渲染用） */
  const [customPets, setCustomPets] = useState<CustomPetInfo[]>([])
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [showRoles, setShowRoles] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null)
  const [todos, setTodos] = useState<TodayTodo[]>([])
  const [goals, setGoals] = useState<PetGoal[]>([])
  const [hovering, setHovering] = useState(false)
  const [scale, setScale] = useState(1)
  /** 视口尺寸：窗口 resize（setSize 上报后）驱动重渲染，保证精灵/热区居中准确 */
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties>({})
  const [bubbleStyle, setBubbleStyle] = useState<CSSProperties>({})

  // 联动动画状态机（一次性动画 > timing > running > idle）；回调均为稳定引用
  const { anim: petAnim, restartKey, trigger, setTiming, setRunning, handleFinish } = usePetAnimState()

  /** 浮层离开隐藏计时器：给鼠标从角色移动到浮层留出过渡时间 */
  const hideTimerRef = useRef<number | null>(null)
  /** 气泡自动消失计时器：统一持有，避免旧气泡的定时器把新气泡提前清掉（竞态） */
  const bubbleTimerRef = useRef<number | null>(null)

  // 当前角色资产（未知 id 回落 bubcat），帧尺寸取自 manifest（非硬编码）
  const { manifest } = getPetAssets()[characterId] ?? getPetAssets().bubcat
  const frameW = manifest.frame.width
  const frameH = manifest.frame.height
  const hitBox = useMemo(
    () => computeHitBox(frameW, frameH, scale, viewport.w),
    [frameW, frameH, scale, viewport.w],
  )

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

  /** 展示气泡并自动消失：先清旧定时器再设新定时器，杜绝「旧定时器提前清掉新气泡」竞态 */
  const showBubble = useCallback((text: string, duration: number) => {
    if (bubbleTimerRef.current != null) {
      window.clearTimeout(bubbleTimerRef.current)
      bubbleTimerRef.current = null
    }
    setBubble(text)
    bubbleTimerRef.current = window.setTimeout(() => {
      bubbleTimerRef.current = null
      setBubble(null)
    }, duration)
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
      // 每次打开菜单刷新自定义宠物列表：主窗口「制作桌宠」保存的新宠物
      // 无需重启桌宠窗口即可立即出现在「切换角色 → 自定义」分组
      void loadCustomPets().then(setCustomPets)
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

  /** 上报桌宠所需窗口尺寸（角色帧 + 缩放 + padding）；角色/缩放/自定义宠物加载后触发 */
  const reportPetSize = useCallback((id: PetCharacterId, s: number) => {
    const { manifest: m } = getPetAssets()[id] ?? getPetAssets().bubcat
    void window.petApi.setSize(computePetWindowSize(m.frame.width, m.frame.height, s))
  }, [])

  // 角色 / 缩放 / 自定义宠物加载变化时，上报窗口所需尺寸
  useEffect(() => {
    reportPetSize(characterId, scale)
  }, [reportPetSize, characterId, scale, customPets])

  // 窗口 resize（setSize 上报后主进程 setBounds）驱动重渲染
  useEffect(() => {
    const onResize = (): void => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 点击随机动作：挥手招呼
  const playRandom = useCallback(() => {
    trigger('waving')
  }, [trigger])

  // 完成待办后的庆祝反馈：finishing 动画 + 撒花 + 鼓励文案气泡
  const celebrate = useCallback(() => {
    trigger('finishing')
    const phrases = ['太棒了！', '真厉害！', '又完成一件！', '继续保持！', '好样的！']
    showBubble(phrases[Math.floor(Math.random() * phrases.length)], 3000)
    if (confettiRef.current) firePetConfetti()
  }, [trigger, showBubble])

  // 初始化：读配置（角色 / 缩放）、加载自定义宠物包、订阅气泡 / 番茄 / 联动动画 /
  // 今日待办、默认鼠标穿透。loadCustomPets 与读配置并行（无强顺序依赖）：配置里的
  // 自定义 id 在注册表就绪前 SpritePetStage 会先回落 bubcat 渲染一帧，宠物包加载
  // 完成后 setCustomPets 触发重渲染即自动切换为自定义角色（可接受的短暂过渡）。
  useEffect(() => {
    let disposed = false
    void loadCustomPets().then((list) => {
      if (!disposed) setCustomPets(list)
    })
    void window.petApi.getConfig().then((cfg) => {
      if (disposed) return
      const s = clampScale(cfg.petScale ?? 1)
      setScale(s)
      confettiRef.current = cfg.confettiEnabled !== false
      // 角色采用非空字符串（内置或自定义 id 均可；自定义 id 无需枚举校验，
      // 未加载完成时由 SpritePetStage 回落 bubcat 兜底），其余回落默认 bubcat
      const target: PetCharacterId =
        typeof cfg.selectedCharacter === 'string' && cfg.selectedCharacter !== ''
          ? cfg.selectedCharacter
          : 'bubcat'
      setCharacterId((current) => (current === target ? current : target))
    })
    // 读取当前显示器工作区（屏幕感知定位），拖拽结束后会刷新
    void window.petApi.getWorkArea().then((area) => {
      if (!disposed) workAreaRef.current = area
    })
    const offBubble = window.petApi.onBubble((text) => {
      showBubble(text, 4000)
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
      // 卸载清理气泡自动消失定时器，避免组件销毁后残留
      if (bubbleTimerRef.current != null) {
        window.clearTimeout(bubbleTimerRef.current)
        bubbleTimerRef.current = null
      }
    }
  }, [setPetInteractive, setTiming, trigger, showBubble])

  /**
   * window 级拖拽状态机：超过阈值判定为拖拽后，仅向主进程发一次 beginDrag，
   * 之后由主进程 16ms 轮询光标绝对定位窗口（DIP 口径，抓取点锁定零漂移）。
   * 拖拽期间按水平方向播放 running-right / running-left。
   */
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const d = dragRef.current
      if (!d.down || d.dragging) {
        // 拖拽进行中：按「帧间」clientX 差值更新跑动朝向（更新 lastX，避免用累计位移判定方向）
        if (d.dragging) {
          const dx = e.clientX - d.lastX
          if (Math.abs(dx) > 1) setRunning(dx > 0 ? 'right' : 'left')
          d.lastX = e.clientX
          d.lastY = e.clientY
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
        // 拖拽可能跨显示器 / 贴边，结束后刷新工作区
        void window.petApi.getWorkArea().then((area) => {
          workAreaRef.current = area
        })
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

  // 浮层：依据实际渲染尺寸 + 屏幕感知偏移定位（顶部锚定精灵上方、水平居中）
  useLayoutEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left = hitBox.left + hitBox.width / 2 - w / 2
    let top = Math.max(8, hitBox.top - 12 - h)
    const off = screenAware({ x: left, y: top, width: w, height: h }, workAreaRef.current)
    setOverlayStyle({ left: Math.round(left + off.dx), top: Math.round(top + off.dy) })
  }, [hovering, hitBox, viewport, todos, goals, characterId])

  // 气泡：依据实际渲染尺寸 + 屏幕感知偏移定位（窗口顶部、水平居中）
  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left = (viewport.w - w) / 2
    let top = 8
    const off = screenAware({ x: left, y: top, width: w, height: h }, workAreaRef.current)
    setBubbleStyle({ left: Math.round(left + off.dx), top: Math.round(top + off.dy) })
  }, [bubble, viewport, characterId])

  const onMouseDown = (e: ReactMouseEvent): void => {
    if (e.button !== 0) return
    dragRef.current = { down: true, moved: false, dragging: false, lastX: e.clientX, lastY: e.clientY }
  }

  const onWheel = (e: ReactWheelEvent): void => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    // 缩放钳制在 [0.3, 1.6]，防止过大或过小
    const next = clampScale(scale + delta)
    setScale(next)
    void window.petApi.setConfig({ petScale: next })
  }

  const onContextMenu = (e: ReactMouseEvent): void => {
    e.preventDefault()
    openMenu(e.clientX, e.clientY)
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

  // 菜单位置：先窗口内钳制，再做屏幕感知平移，最后再窗口内钳制（保证既可见又不溢出窗口）
  const menuPos = (() => {
    if (!menu) return null
    const raw = clampMenuPosition(menu.x, menu.y)
    const off = screenAware({ x: raw.x, y: raw.y, width: MENU_WIDTH, height: MENU_HEIGHT }, workAreaRef.current)
    return clampMenuPosition(raw.x + off.dx, raw.y + off.dy)
  })()

  return (
    <div className="pet-root">
      <SpritePetStage
        characterId={characterId}
        scale={scale}
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
          rootRef={overlayRef}
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

      <Bubble text={bubble ?? ''} style={bubbleStyle} rootRef={bubbleRef} />
      <PomodoroBadge state={pomodoro} />

      {menu && menuPos && (
        <div
          ref={menuRef}
          className="pet-menu"
          style={{ left: menuPos.x, top: menuPos.y }}
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
              {/* 内置角色（编译期静态资产） */}
              <div className="pet-menu-group">内置</div>
              {PET_CHARACTERS.map((m) => (
                <button key={m.id} onClick={() => switchCharacter(m.id)}>
                  <span className="pet-menu-check">{m.id === characterId ? '✓' : ''}</span>
                  {getPetName(m.id) ?? m.id}
                </button>
              ))}
              {/* 自定义宠物（运行时宠物包加载，与内置共用 switchCharacter 写配置） */}
              <div className="pet-menu-group">自定义</div>
              {customPets.length === 0 ? (
                <button disabled>暂无自定义宠物</button>
              ) : (
                customPets.map((m) => (
                  <button key={m.id} onClick={() => switchCharacter(m.id)}>
                    <span className="pet-menu-check">{m.id === characterId ? '✓' : ''}</span>
                    {getPetName(m.id) ?? m.id}
                  </button>
                ))
              )}
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
