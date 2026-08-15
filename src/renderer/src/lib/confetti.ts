/**
 * 撒花动画封装（canvas-confetti）。
 */
import confetti from 'canvas-confetti'

/** 勾选完成时触发一次撒花；由调用方判断 config.confettiEnabled */
export function fireConfetti(): void {
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 38,
    scalar: 0.9,
    origin: { y: 0.7 },
    zIndex: 9999,
  })
}
