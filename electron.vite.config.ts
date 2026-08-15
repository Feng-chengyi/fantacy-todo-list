import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * electron-vite 三端统一配置：
 * - main：主进程，外部化 node_modules 依赖
 * - preload：两个预加载脚本（主窗口 / 桌宠窗口）
 * - renderer：双渲染入口（main 日历主窗口 + pet Live2D 桌宠窗口）
 *
 * 说明：renderer.publicDir 指向 src/pet/public，使 live2d 资源（core + haru/hiyori/natori
 * 多角色模型）在 dev 下可被静态服务、在 build 时复制进 out/renderer 根目录，完全离线加载。
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          pet: resolve('src/preload/pet.ts'),
        },
      },
    },
  },
  renderer: {
    publicDir: resolve('src/pet/public'),
    plugins: [react()],
    build: {
      // 每次构建清空 out/renderer，避免陈旧产物（旧模型/旧 hash 资源）残留撑大安装包
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve('src/renderer/index.html'),
          pet: resolve('src/renderer/pet.html'),
        },
      },
    },
  },
})
