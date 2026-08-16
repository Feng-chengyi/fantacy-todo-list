/**
 * 精灵渲染舞台：spritesheet 横排帧，background-position 换帧，pixelated 硬边缩放。
 * 帧尺寸取自清单 manifest.frame（非硬编码），精灵盒复用 shared/petWindow.computeSpriteBox
 * （顶部锚定 PET_WINDOW_PAD.top、水平居中）。联动动画状态由 usePetAnimState 驱动。
 */
import type { PetCharacterId } from '../../../shared/types'
import { computeSpriteBox } from '../../../shared/petWindow'
import { getPetAssets, type PetAnim } from './petAssets'
import { useSpriteAnim } from './useSpriteAnim'

interface Props {
  characterId: PetCharacterId
  scale: number
  /** 当前动画（受控） */
  anim: PetAnim
  /** 重复触发同动画时的重启序号（一次性动画连播） */
  restartKey: number
  /** 非循环动画播完回调（回落到持续状态动画） */
  onAnimFinish?: (anim: PetAnim) => void
}

export function SpritePetStage({ characterId, scale, anim, restartKey, onAnimFinish }: Props) {
  // 空值防护：未知角色回退到默认泡泡猫（bubcat 键必然存在）。自定义 id 在宠物包
  // 加载完成前会短暂走此回落，loadCustomPets 完成后随上层重渲染自动切换为自定义角色。
  // getPetAssets() 每次渲染同步读当前注册表（内置 + 运行时合并的自定义宠物）。
  const { sheet, manifest } = getPetAssets()[characterId] ?? getPetAssets().bubcat
  // 动画回落：清单缺当前动画定义时回落 idle（自定义包适配层已补齐七键，此处纯兜底）
  const activeAnim: PetAnim = manifest.animations[anim] ? anim : 'idle'
  const frame = useSpriteAnim(manifest.animations, activeAnim, restartKey, onAnimFinish)
  const frameCount = manifest.spritesheet.frameCount

  // 帧尺寸取自 manifest（内置 192x208，自定义包校验同规格，此处不硬编码）
  const frameW = manifest.frame.width
  const frameH = manifest.frame.height
  const w = Math.round(frameW * scale)
  const h = Math.round(frameH * scale)
  const box = computeSpriteBox(frameW, frameH, scale, window.innerWidth)

  return (
    <div
      className="sprite-stage"
      style={{
        width: w,
        height: h,
        left: box.left,
        top: box.top,
        backgroundImage: `url(${sheet})`,
        backgroundSize: `${w * frameCount}px ${h}px`,
        backgroundPosition: `${-frame * w}px 0`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  )
}
