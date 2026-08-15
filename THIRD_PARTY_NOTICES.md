# Third-Party Notices

本项目源代码以 MIT 许可发布（见 `LICENSE`）。桌面桌宠功能依赖以下 **Live2D 专有资源**，其版权与许可条款**不属于** MIT 许可范围，请在使用、分发时单独遵守其原始许可。

> **重要**：以下资源**不随本仓库分发**（未纳入 git）。请运行 `npm run fetch:assets` 从 Live2D 官方源拉取到本地 `src/pet/public/live2d/` 后再运行应用。

## Live2D Cubism Core

- 文件：`src/pet/public/live2d/live2dcubismcore.min.js`
- 来源：`https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js`
- 版权：© Live2D Inc. 保留所有权利。
- 说明：该文件为 Live2D Cubism SDK 的「可再分发代码（Redistributable Code）」，依据 Live2D 专有许可协议分发。完整许可文本见文件头部注释及 Live2D 官方 SDK。
- 使用约束：仅用于运行本应用，不得修改、反向工程或脱离 Live2D 许可条款单独分发。

## Live2D 示例模型（Haru / Hiyori / Natori / Mao / Wanko / Rice）

- 文件：`src/pet/public/live2d/models/{haru,hiyori,natori,mao,wanko,rice}/`（模型、贴图、动作、表情、物理、姿势、音效等）
- 来源：Live2D 官方 `Live2D/CubismWebSamples` 仓库（经 jsDelivr CDN 拉取）
- 版权：© Live2D Inc. 示例模型（Sample Model）。
- 说明：上述角色均为 Live2D 官方示例角色（Haru 春 / Hiyori 日和 / Natori 名取 / Mao 猫 / Wanko 狗 / Rice 鼠），随 Live2D Cubism SDK / CubismWebSamples 提供，用于演示与个人学习用途。请遵守 Live2D 示例模型的原始许可条款。

---

> 若你计划将本项目用于商业用途或二次分发，请务必阅读并遵守 Live2D Cubism SDK 与示例模型的原始许可协议（https://www.live2d.com/）。
