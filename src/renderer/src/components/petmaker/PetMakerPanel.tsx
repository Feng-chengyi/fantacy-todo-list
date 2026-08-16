/**
 * 「制作桌宠」向导面板：三步把用户图片做成桌宠精灵并保存为宠物包。
 *
 * 步骤1 预处理：选图 → 键控去背景（自动采样 / 点击取色 + 容差滑块）
 * 步骤2 风格化：像素化网格 / 颜色量化 / 硬边描边
 * 步骤3 动画与保存：composeSheet 合成 15 帧 → 试播 7 组动画 → 保存宠物包
 *
 * 另附「我的宠物」列表 tab：查看 / 导出 / 删除 / 导入 .petpack。
 * 管线参数变化时同步重算（图像仅 192x208，计算量小）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useUiStore } from '../../stores/uiStore'
import {
  extractSubject,
  letterboxTo,
  outline,
  pixelate,
  removeBackground,
  sampleEdgeBackgroundColor,
  trimAlphaEdges,
  type PixelData,
  type RGB,
} from '../../lib/petImage'
import {
  buildPetManifest,
  composeSheet,
  detectEdgeContactFrames,
  makeGridCheck,
} from '../../lib/petFrameComposer'
import { loadImageFromFile, pixelsToCanvasElement, pixelsToDataUrl } from '../../lib/pixelsToCanvas'
import { PET_FRAME_H, PET_FRAME_W, normalizePetId } from '../../../../shared/petPack'
import type { PetPackEntry } from '../../../../shared/types'
import * as ipc from '../../services/ipc'

/** 动画键（与 buildPetManifest 布局一致） */
type AnimKey =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'timing'
  | 'finishing'

/** 7 组试播动画：中文标签 + 帧索引表 + fps（帧布局同 buildPetManifest） */
const ANIMS: { key: AnimKey; label: string; frames: number[]; fps: number }[] = [
  { key: 'idle', label: '空闲', frames: [0, 1], fps: 2 },
  { key: 'running-right', label: '向右跑', frames: [2, 3], fps: 8 },
  { key: 'running-left', label: '向左跑', frames: [4, 5], fps: 8 },
  { key: 'waving', label: '挥手', frames: [6, 7], fps: 4 },
  { key: 'jumping', label: '跳跃', frames: [8, 9], fps: 5 },
  { key: 'timing', label: '计时', frames: [10, 11], fps: 2 },
  { key: 'finishing', label: '完成', frames: [12, 13, 14], fps: 5 },
]

/** 三步标题（步骤指示条用） */
const STEP_TITLES = ['预处理', '风格化', '动画与保存']

/**
 * 像素预览：把 PixelData 画成 canvas 挂到容器 div（pixelated 硬边缩放）。
 * onPick 提供时支持点击取色（坐标已换算回像素坐标系）。
 */
function PixelPreview({
  px,
  maxHeight,
  onPick,
}: {
  px: PixelData
  maxHeight?: number
  onPick?: (x: number, y: number) => void
}): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const canvas = pixelsToCanvasElement(px)
    canvas.style.display = 'block'
    canvas.style.imageRendering = 'pixelated'
    canvas.style.maxWidth = '100%'
    canvas.style.height = 'auto'
    if (maxHeight !== undefined) canvas.style.maxHeight = `${maxHeight}px`
    host.replaceChildren(canvas)
    return (): void => {
      host.replaceChildren()
    }
  }, [px, maxHeight])

  // 点击换算：canvas 可能被 CSS 缩放，按显示尺寸与内在尺寸比例映射
  const onClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
    if (!onPick) return
    const canvas = hostRef.current?.querySelector('canvas')
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * px.width)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * px.height)
    if (x < 0 || y < 0 || x >= px.width || y >= px.height) return
    onPick(x, y)
  }

  return (
    <div
      ref={hostRef}
      onClick={onClick}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 8,
        overflow: 'hidden',
        cursor: onPick ? 'crosshair' : undefined,
      }}
    />
  )
}

export function PetMakerPanel(): JSX.Element {
  const setShowPetMaker = useUiStore((s) => s.setShowPetMaker)

  /** 顶层 tab：制作向导 / 我的宠物 */
  const [tab, setTab] = useState<'wizard' | 'packs'>('wizard')
  /** 当前向导步骤 1-3 */
  const [step, setStep] = useState(1)

  // ---- 源图 ----
  const [sourcePixels, setSourcePixels] = useState<PixelData | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceName, setSourceName] = useState('')

  // ---- 步骤1 参数：去背景 ----
  const [tolerance, setTolerance] = useState(32)
  const [manualKey, setManualKey] = useState<RGB | null>(null)

  // ---- 步骤2 参数：风格化 ----
  const [pixelGrid, setPixelGrid] = useState(48)
  const [maxColors, setMaxColors] = useState(24)
  const [outlineOn, setOutlineOn] = useState(true)

  // ---- 步骤3：试播 / 保存 ----
  const [previewAnim, setPreviewAnim] = useState<AnimKey>('idle')
  const [showGridCheck, setShowGridCheck] = useState(false)
  const [petName, setPetName] = useState('')
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // ---- 我的宠物列表 ----
  const [packs, setPacks] = useState<PetPackEntry[]>([])
  const [packMsg, setPackMsg] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const frameCanvasRef = useRef<HTMLCanvasElement>(null)

  /** 打开面板时加载已安装宠物列表 */
  const refreshPacks = useCallback(async (): Promise<void> => {
    try {
      setPacks(await ipc.petPackList())
    } catch {
      // 列表加载失败不阻塞向导
    }
  }, [])

  useEffect(() => {
    void refreshPacks()
  }, [refreshPacks])

  /** 选择源图：解码 → 存像素与文件名，重置手动取色 */
  const onFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (!file) return
    try {
      const { pixels, url } = await loadImageFromFile(file)
      setSourcePixels(pixels)
      setSourceUrl(url)
      setSourceName(file.name)
      setManualKey(null)
      setSaveMsg(null)
    } catch (err) {
      setSaveMsg(`图片加载失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ---- 管线：步骤1 去背景（结果与源图同尺寸，便于点击取色映射） ----
  const step1 = useMemo<PixelData | null>(() => {
    if (!sourcePixels) return null
    // manualKey 为 null 时 removeBackground 内部自动用边缘采样色
    return trimAlphaEdges(removeBackground(sourcePixels, { key: manualKey, tolerance }))
  }, [sourcePixels, manualKey, tolerance])

  /** 自动采样色（色块展示用；removeBackground 内部会重复计算一次，代价可忽略） */
  const autoKey = useMemo<RGB | null>(
    () => (sourcePixels ? sampleEdgeBackgroundColor(sourcePixels) : null),
    [sourcePixels]
  )

  // ---- 管线：步骤1 → 基础精灵 192x208 ----
  const base = useMemo<PixelData | null>(() => {
    if (!step1) return null
    const subject = extractSubject(step1).pixels
    let out = letterboxTo(subject, PET_FRAME_W, PET_FRAME_H, 12)
    if (pixelGrid > 0) {
      const gridH = Math.round((pixelGrid * PET_FRAME_H) / PET_FRAME_W)
      out = pixelate(out, pixelGrid, gridH, maxColors > 0 ? maxColors : undefined)
    }
    if (outlineOn) {
      // 1 网格 = 192/gridW 像素；关闭像素化（原图）时退回 4px（=192/48 默认粒度）
      const gridScale = pixelGrid > 0 ? Math.max(1, Math.round(PET_FRAME_W / pixelGrid)) : 4
      out = outline(out, gridScale)
    }
    return out
  }, [step1, pixelGrid, maxColors, outlineOn])

  // ---- 管线：步骤3 合成 spritesheet + QA ----
  const sheetData = useMemo<
    { sheetUrl: string; gridCheckUrl: string; edgeViolations: number[] } | null
  >(() => {
    if (!base) return null
    const sheet = composeSheet(base)
    return {
      sheetUrl: pixelsToDataUrl(sheet),
      gridCheckUrl: pixelsToDataUrl(makeGridCheck(sheet)),
      edgeViolations: detectEdgeContactFrames(sheet),
    }
  }, [base])

  /** 把 sheet 的第 frameIdx 帧切片绘制到预览 canvas（pixelated 关平滑） */
  const drawSheetFrame = useCallback((img: HTMLImageElement, frameIdx: number): void => {
    const canvas = frameCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      img,
      frameIdx * PET_FRAME_W,
      0,
      PET_FRAME_W,
      PET_FRAME_H,
      0,
      0,
      canvas.width,
      canvas.height
    )
  }, [])

  // ---- 试播：按当前动画 fps 轮换帧（卸载 / 切换动画时清理 interval） ----
  useEffect(() => {
    if (tab !== 'wizard' || step !== 3 || !sheetData) return
    const anim = ANIMS.find((a) => a.key === previewAnim) ?? ANIMS[0]
    let timer: number | undefined
    let cancelled = false
    const img = new Image()
    img.onload = (): void => {
      if (cancelled) return
      let idx = 0
      const draw = (): void => {
        drawSheetFrame(img, anim.frames[idx % anim.frames.length])
        idx += 1
      }
      draw()
      timer = window.setInterval(draw, Math.max(1, Math.round(1000 / anim.fps)))
    }
    img.src = sheetData.sheetUrl
    return (): void => {
      cancelled = true
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [tab, step, sheetData, previewAnim, drawSheetFrame])

  /** 步骤1 点击取色：读该像素 RGB 设为手动键控色 */
  const onPickColor = useCallback(
    (x: number, y: number): void => {
      if (!step1) return
      const i = (y * step1.width + x) * 4
      setManualKey({ r: step1.data[i], g: step1.data[i + 1], b: step1.data[i + 2] })
    },
    [step1]
  )

  /** 保存宠物包：manifest + sheet base64 → petPackSave */
  const onSave = async (): Promise<void> => {
    if (!sheetData || !petName.trim()) return
    const name = petName.trim()
    const id = normalizePetId(name)
    const base64 = sheetData.sheetUrl.replace('data:image/png;base64,', '')
    try {
      await ipc.petPackSave(buildPetManifest(id, name), base64, sourceName || undefined)
      setSaveMsg('已保存')
      void refreshPacks()
    } catch (err) {
      setSaveMsg(`保存失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /** 导出宠物包为 .petpack */
  const onExport = async (id: string): Promise<void> => {
    const res = await ipc.petPackExport(id)
    if (res.canceled) setPackMsg('已取消导出')
    else if (res.error) setPackMsg(`导出失败：${res.error}`)
    else setPackMsg(`已导出到 ${res.path}`)
  }

  /** 删除宠物包（确认后） */
  const onDelete = async (entry: PetPackEntry): Promise<void> => {
    if (!window.confirm(`确定删除「${entry.meta.name}」？`)) return
    try {
      await ipc.petPackDelete(entry.meta.id)
      setPackMsg(`已删除「${entry.meta.name}」`)
      void refreshPacks()
    } catch (err) {
      setPackMsg(`删除失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /** 导入 .petpack */
  const onImport = async (): Promise<void> => {
    const res = await ipc.petPackImport()
    if (res.ok) {
      setPackMsg(`已导入「${res.meta?.name ?? ''}」`)
      void refreshPacks()
    } else {
      setPackMsg(`导入失败：${res.error ?? '未知错误'}`)
    }
  }

  /** 当前键控色（手动优先，其次自动采样） */
  const currentKey: RGB | null = manualKey ?? autoKey

  /** 步骤指示是否可跳转（无源图时只能停留在步骤1） */
  const canGoStep = (n: number): boolean => n === 1 || sourcePixels !== null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={() => setShowPetMaker(false)}
    >
      <div
        className="flex max-h-[88vh] w-[780px] flex-col rounded-xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部：标题 + tab 切换 + 关闭 */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">制作桌宠</h2>
          <div className="flex items-center gap-2">
            <div className="view-tabs">
              <button
                className={tab === 'wizard' ? 'active' : ''}
                onClick={() => setTab('wizard')}
              >
                制作向导
              </button>
              <button
                className={tab === 'packs' ? 'active' : ''}
                onClick={() => setTab('packs')}
              >
                我的宠物
              </button>
            </div>
            <button className="text-btn" onClick={() => setShowPetMaker(false)}>
              ✕
            </button>
          </div>
        </div>

        {tab === 'wizard' ? (
          <>
            {/* 三步步骤指示 */}
            <div className="view-tabs mb-4 self-start">
              {STEP_TITLES.map((title, i) => {
                const n = i + 1
                const enabled = canGoStep(n)
                return (
                  <button
                    key={title}
                    className={step === n ? 'active' : ''}
                    disabled={!enabled}
                    style={enabled ? undefined : { opacity: 0.4, cursor: 'not-allowed' }}
                    onClick={() => setStep(n)}
                  >
                    {n}·{title}
                  </button>
                )
              })}
            </div>

            {/* 内容区（可滚动） */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {step === 1 && (
                <div className="flex gap-4">
                  <div className="flex min-w-0 flex-1 items-start justify-center">
                    {step1 ? (
                      <PixelPreview px={step1} maxHeight={320} onPick={onPickColor} />
                    ) : (
                      <div className="empty-state w-full">
                        <div className="empty-state-icon">🐾</div>
                        <div className="empty-state-title">先选择一张图片</div>
                        <div className="empty-state-desc">
                          建议主体居中、背景颜色单一的照片或插画，向导会自动抠出主体
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="w-64 shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void onFile(e)}
                    />
                    <button className="ghost-btn" onClick={() => fileInputRef.current?.click()}>
                      {sourcePixels ? '重新选择图片' : '选择图片'}
                    </button>
                    {sourcePixels && (
                      <div className="mt-3 flex flex-col gap-3">
                        {/* 源图对照缩略 */}
                        {sourceUrl && (
                          <img
                            src={sourceUrl}
                            alt={sourceName}
                            style={{
                              width: '100%',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                            }}
                          />
                        )}
                        <div>
                          <div className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            背景容差：{tolerance}
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={120}
                            value={tolerance}
                            className="w-full"
                            onChange={(e) => setTolerance(Number(e.target.value))}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span style={{ color: 'var(--text-muted)' }}>
                            {manualKey ? '手动取色' : '自动取色'}
                          </span>
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: '1px solid var(--border)',
                              background: currentKey
                                ? `rgb(${currentKey.r}, ${currentKey.g}, ${currentKey.b})`
                                : 'transparent',
                            }}
                          />
                          {currentKey && (
                            <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                              {currentKey.r},{currentKey.g},{currentKey.b}
                            </span>
                          )}
                        </div>
                        <button
                          className="ghost-btn"
                          disabled={manualKey === null}
                          onClick={() => setManualKey(null)}
                        >
                          恢复自动取色
                        </button>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          点击预览图可手动指定背景色
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex gap-4">
                  <div className="flex min-w-0 flex-1 items-start justify-center">
                    {base && <PixelPreview px={base} maxHeight={320} />}
                  </div>
                  <div className="flex w-64 shrink-0 flex-col gap-3 text-xs">
                    <div>
                      <div className="mb-1" style={{ color: 'var(--text-muted)' }}>
                        像素化网格
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[0, 24, 48, 64].map((n) => (
                          <button
                            key={n}
                            className={`category-chip${pixelGrid === n ? ' active' : ''}`}
                            onClick={() => setPixelGrid(n)}
                          >
                            {n === 0 ? '原图' : `${n} 格`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1" style={{ color: 'var(--text-muted)' }}>
                        颜色数量
                      </div>
                      <div
                        className="flex flex-wrap gap-1.5"
                        style={
                          pixelGrid === 0
                            ? { opacity: 0.45, pointerEvents: 'none' }
                            : undefined
                        }
                      >
                        {[0, 12, 24, 48].map((n) => (
                          <button
                            key={n}
                            className={`category-chip${maxColors === n ? ' active' : ''}`}
                            onClick={() => setMaxColors(n)}
                          >
                            {n === 0 ? '不量化' : `${n} 色`}
                          </button>
                        ))}
                      </div>
                      {pixelGrid === 0 && (
                        <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                          原图模式下不进行颜色量化
                        </div>
                      )}
                    </div>
                    <label className="setting-row !justify-start gap-2">
                      <input
                        type="checkbox"
                        checked={outlineOn}
                        onChange={(e) => setOutlineOn(e.target.checked)}
                      />
                      <span>硬边描边</span>
                    </label>
                  </div>
                </div>
              )}

              {step === 3 && sheetData && (
                <div className="flex gap-4">
                  {/* 左：试播预览 / grid-check */}
                  <div className="flex min-w-0 flex-1 items-start justify-center">
                    {showGridCheck ? (
                      <img
                        src={sheetData.gridCheckUrl}
                        alt="帧切分检查"
                        style={{
                          width: '100%',
                          imageRendering: 'pixelated',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          background: 'var(--bg)',
                        }}
                      />
                    ) : (
                      <canvas
                        ref={frameCanvasRef}
                        width={PET_FRAME_W}
                        height={PET_FRAME_H}
                        style={{
                          width: 288,
                          height: 312,
                          imageRendering: 'pixelated',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          background: 'var(--bg)',
                        }}
                      />
                    )}
                  </div>
                  {/* 右：动画试播 + 命名保存 */}
                  <div className="flex w-72 shrink-0 flex-col gap-3 text-xs">
                    <div>
                      <div className="mb-1" style={{ color: 'var(--text-muted)' }}>
                        试播动画
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ANIMS.map((a) => (
                          <button
                            key={a.key}
                            className={`category-chip${previewAnim === a.key ? ' active' : ''}`}
                            onClick={() => setPreviewAnim(a.key)}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showGridCheck}
                        onChange={(e) => setShowGridCheck(e.target.checked)}
                      />
                      <span>显示帧切分检查图</span>
                    </label>
                    {sheetData.edgeViolations.length > 0 && (
                      <div className="conflict-warning">
                        第 {sheetData.edgeViolations.map((v) => v + 1).join('、')}{' '}
                        帧贴边，建议调整
                      </div>
                    )}
                    <div className="mt-1 flex gap-2">
                      <input
                        className="input min-w-0 flex-1"
                        placeholder="宠物名（如：团子）"
                        value={petName}
                        maxLength={40}
                        onChange={(e) => setPetName(e.target.value)}
                      />
                      <button
                        className="primary-btn"
                        disabled={!petName.trim()}
                        onClick={() => void onSave()}
                      >
                        保存
                      </button>
                    </div>
                    {saveMsg && (
                      <div
                        style={{
                          color: saveMsg === '已保存' ? 'var(--accent)' : 'var(--priority-high)',
                        }}
                      >
                        {saveMsg}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 底部：源图名 + 上一步/下一步 */}
            <div
              className="mt-4 flex items-center justify-between border-t pt-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {sourceName || '未选择源图'}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  className="ghost-btn"
                  disabled={step <= 1}
                  onClick={() => setStep(Math.max(1, step - 1))}
                >
                  上一步
                </button>
                {step < 3 && (
                  <button
                    className="primary-btn"
                    disabled={step === 1 && !sourcePixels}
                    onClick={() => setStep(Math.min(3, step + 1))}
                  >
                    下一步
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ---- 我的宠物 tab ---- */
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-3 flex items-center gap-2">
              <button className="ghost-btn" onClick={() => void onImport()}>
                导入 .petpack
              </button>
              {packMsg && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {packMsg}
                </span>
              )}
            </div>
            {packs.length === 0 ? (
              <div className="panel-empty">还没有自定义宠物，去「制作向导」做一只吧</div>
            ) : (
              <ul className="panel-list">
                {packs.map((p) => (
                  <li key={p.meta.id} className="habit-item">
                    {/* 缩略图：sheet 首帧左上角 96x104 裁切 */}
                    {p.sheetDataUrl && (
                      <img
                        src={p.sheetDataUrl}
                        alt={p.meta.name}
                        style={{
                          width: 96,
                          height: 104,
                          objectFit: 'none',
                          objectPosition: '0 0',
                          imageRendering: 'pixelated',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--bg)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span className="habit-title">{p.meta.name}</span>
                    <div className="habit-actions">
                      <button className="mini-btn" onClick={() => void onExport(p.meta.id)}>
                        导出
                      </button>
                      <button className="mini-btn" onClick={() => void onDelete(p)}>
                        删除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
