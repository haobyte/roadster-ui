# 第三方依赖

| 依赖 | 版本 | 用途 | 许可证 |
| --- | --- | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | 0.180.0 | 浏览器三维渲染，打包进入运行脚本 | MIT；原文见 `licenses/three.txt`，构建时另复制为 `dist/THREE-LICENSE.txt` |
| [esbuild](https://github.com/evanw/esbuild) | 0.25.12 | 开发时构建 | MIT；许可证随 npm 包提供 |
| [Playwright](https://github.com/microsoft/playwright) | 1.62.1 | 开发时浏览器回归 | Apache-2.0；许可证及通知随 npm 包提供 |

版本和间接依赖由 `package-lock.json` 锁定。构建工具和测试浏览器不随 Pages 静态包发布。

模型与图片的单独说明见 [ASSETS.md](ASSETS.md)。项目代码的许可证不替代这些依赖和资源的原有条款。
