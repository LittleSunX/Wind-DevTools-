# 开发指南

### 技术栈

| 部分       | 实现                                       |
| ---------- | ------------------------------------------ |
| 页面与类型 | React 19、TypeScript                       |
| 开发与构建 | Vite、静态 HTML 预渲染                     |
| 工具处理   | Web Worker、sql-formatter、cron-parser     |
| 代码图片   | Prism 语法高亮、Canvas 渲染与 PNG 导出     |
| 验证       | Vitest、Playwright + 本机 Chrome、Prettier |

### 常用命令

| 命令                      | 用途                                             |
| ------------------------- | ------------------------------------------------ |
| `npm run dev`             | 启动开发服务器                                   |
| `npm run build`           | 类型检查、生产构建和静态预渲染                   |
| `npm run preview`         | 启动生产预览，默认端口 4173                      |
| `npm test`                | 工具逻辑、代码高亮及统计白名单测试               |
| `npm run test:build`      | 检查构建产物、canonical、sitemap 与预览收录策略  |
| `npm run test:browser`    | 现有文本工具、隐私、移动端、取消和超时验收       |
| `npm run test:code-image` | PNG 内容与尺寸、透明度、剪贴板和代码图片交互验收 |
| `npm run format`          | 格式化源码与配置                                 |
| `npm run format:check`    | 检查代码格式                                     |

单元测试可直接运行。构建检查需先执行 `npm run build`；浏览器验收还需要安装 Chrome，并保持 `npm run preview` 在另一个终端运行：

```sh
npm test
npm run test:build
npm run test:browser
npm run test:code-image
```

浏览器测试默认连接 `http://localhost:4173`，也可以传入地址：

```sh
npm run test:browser -- http://localhost:4173
npm run test:code-image -- http://localhost:4173
```

测试截图与导出样例写入 `artifacts/`，不纳入版本控制。README 展示图片位于 `docs/images/`。

### 项目结构

```text
src/
├── App.tsx                 工具首页、导航与文本工具交互
├── catalog.ts              工具名称、分类、描述和示例
├── components/CodeImage.tsx 代码图片编辑与预览
├── utils/                  独立工具逻辑、语法高亮与图片渲染
├── worker.ts               文本工具后台处理入口
├── code-image.worker.ts    代码高亮后台处理入口
└── analytics.ts            可选统计与载荷白名单
scripts/
├── prerender.ts            静态页面与 SEO 文件生成
├── preview.mjs             生产文件预览服务
├── build-check.mjs         构建产物检查
├── browser-check.mjs       文本工具浏览器验收
└── code-image-check.mjs    代码图片浏览器验收
tests/                      单元与回归测试
docs/images/                项目展示图片
```

新增工具时，将处理逻辑放入 `src/utils/`，再接入工具清单、页面和 Worker，并补充相应测试。处理模块保持本地运行，统计仅记录允许的事件字段。

---

[返回项目首页](../README.md)
