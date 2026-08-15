import { defineConfig } from 'vitest/config'

/**
 * vitest 单测配置：仅针对纯函数模块（repeatEngine 等），运行于 node 环境，
 * 不依赖 electron / DOM，保证 CI 可稳定运行。
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
})
