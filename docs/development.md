# 开发指南

### 技术栈

| 部分       | 实现                                       |
| ---------- | ------------------------------------------ |
| 页面与类型 | React 19、TypeScript                       |
| 开发与构建 | Vite、静态 HTML 预渲染                     |
| 工具处理   | Web Worker、sql-formatter、cron-parser     |
| 代码画布   | Prism 语法高亮、DOM 编辑与 PNG / SVG 导出 |
| 国际化 | i18next、react-i18next、中英文 JSON 资源 |
| 验证       | Vitest、Playwright（Chromium / Firefox / WebKit）、Prettier |

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

### 自动化与浏览器覆盖

GitHub Actions 在 push 和 pull request 时执行格式检查、单元测试、构建检查、Chrome 系列浏览器回归和跨浏览器验收。失败时上传测试截图、PNG 等产物。

本机运行跨浏览器验收：

```sh
npx playwright install chromium firefox webkit
npm run test:compat
```

先完成构建并启动预览服务。验收覆盖 Chromium、Firefox、WebKit 与 WebKit 触屏模拟，包括旧图保留但禁止导出、偏好隐私、语言菜单和 PNG 下载。WebKit 模拟不等同于真机 Safari，软键盘和系统剪贴板仍需真机验收。

原有浏览器脚本默认使用本机 Chrome；设置 `PW_CHANNEL=bundled` 可改用 Playwright 自带 Chromium，CI 使用此模式。

---

[返回项目首页](../README.md)


### 国际化

界面使用 `i18next` 与 `react-i18next`。配置位于 `src/i18n/index.ts`，翻译资源位于 `src/i18n/locales/zh.json` 和 `en.json`，React 组件通过 `useLocale()` 订阅语言变化，通过 `tr()` 读取文案。

目前采用中文原文作为资源键（关闭 keySeparator 和 nsSeparator），两份语言资源保持相同的键。新增或修改文案时同步更新资源；动态值使用 `{{name}}` 插值，数量使用 `{{count}}` 及语言对应的复数形式，不拼接句子。`tests/i18n.test.ts` 检查两种语言的键和插值变量是否一致。

新增语言：

1. 在 `src/i18n/locales/` 增加对应 JSON 文件，翻译现有资源键。
2. 在 `src/i18n/index.ts` 的 `resources` 中注册资源，并将语言代码和原生名称加入 `supportedLanguages`。
3. 为该语言补充资源检查与浏览器布局验收。默认回退语言为中文。

语言偏好保存在 `wind.language`；没有有效偏好时，按浏览器语言优先级选择支持的语言。静态预渲染与首次水合均使用中文，挂载后应用用户偏好，避免服务端和客户端标记不一致。切换只更新文案，不重新挂载工具或重置输入。

工具分类和风格预设保留稳定的内部值，在显示时翻译。不要翻译用户输入、代码、窗口标题或已有结果。Worker 接收当前界面语言，为新生成的说明性结果使用相应语言；错误通过原始资源键或 `MessageError` 的结构化插值数据返回，使已显示的错误也能随界面语言切换。

运行 `npm run test:i18n` 验证浏览器语言识别、偏好保存、切换时保留内容、错误翻译、工具间传递、移动端布局和存储不可用情形。该测试使用 Playwright 自带的 Chromium、Firefox、WebKit，需要先构建并启动预览。
