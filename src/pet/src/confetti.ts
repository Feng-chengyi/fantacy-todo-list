/**
 * 桌宠窗口撒花（canvas-confetti，与主窗口同一依赖）。
 */
import confetti from 'canvas-confetti'

/** 完成待办时的庆祝撒花 */
export function firePetConfetti(): void {
  confetti({
    particleCount: 60,
    spread: 65,
    startVelocity: 35,
    scalar: 0.8,
    origin: { y: 0.6 },
    zIndex: 9999,
  })
}
