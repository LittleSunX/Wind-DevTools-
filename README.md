<div align="center">

# Wind DevTools

**常用工具，刚刚好。**

为开发中的小任务，准备一套顺手的工具。<br/>
格式化数据、转换时间、整理 SQL，也把代码变成好看的图片。

<p>
  <img src="https://img.shields.io/badge/React-19-20232b?style=flat-square&amp;logo=react&amp;logoColor=61dafb" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-20232b?style=flat-square&amp;logo=typescript&amp;logoColor=3178c6" alt="TypeScript 5.7" />
  <img src="https://img.shields.io/badge/Vite-6-20232b?style=flat-square&amp;logo=vite&amp;logoColor=9484ff" alt="Vite 6" />
</p>

**免费使用 · 无需登录 · 浏览器本地处理**

[功能](#功能) · [快速开始](#快速开始) · [部署](#部署) · [文档](#文档) · [反馈建议](https://github.com/LittleSunX/Wind-DevTools-/issues)

<br/>

<img src="docs/images/toolbox.jpg" alt="Wind DevTools 首页：六个常用开发工具" width="960" />

</div>

## 功能

<table>
<tr>
<td width="50%">
<strong>🧩 JSON 格式化</strong><br/>
格式化、压缩与校验。保留大整数精度，发现重复键。
</td>
<td width="50%">
<strong>🕒 时间戳转换</strong><br/>
秒、毫秒与日期双向转换，支持 UTC 和本地时区。
</td>
</tr>
<tr>
<td>
<strong>🔑 JWT 解析</strong><br/>
查看 Header、Payload 与时间字段，标明过期状态。
</td>
<td>
<strong>🗃️ SQL 格式化</strong><br/>
整理 MySQL、PostgreSQL、Oracle 查询，调整缩进与大小写。
</td>
</tr>
<tr>
<td>
<strong>⏱️ Cron 表达式</strong><br/>
Linux / Quartz 常用语法，快捷生成并查看未来执行时间。
</td>
<td>
<strong>🎨 代码画布</strong><br/>
在成品画布中直接编辑代码与标题，一键复制或导出高清 PNG。
</td>
</tr>
</table>

### 让代码，也有好看的表达

代码画布支持 **28 种语言与格式**，语言可搜索，直接在画布中编辑代码，支持高亮、缩进、撤销和查找。六套风格预设搭配明暗主题、渐变与透明背景，支持行号、字体、字号、行高和窗口标题设置。支持指定画布宽度和长行自动换行，画布随代码自然增高，查看时可缩放，导出尺寸保持不变。提供 **1× / 2× / 3× PNG** 和图片复制，下载文件按日期时间命名，无水印。

<details>
<summary><strong>展开查看代码画布</strong></summary>

<br/>

![代码画布：直接编辑成品并导出图片](docs/images/code-image.jpg)

</details>

## 快速开始

使用 **Node.js 22** 和 **npm**：

```sh
git clone https://github.com/LittleSunX/Wind-DevTools-.git
cd Wind-DevTools-
npm ci
npm run dev
```

打开 [localhost:5173/tools](http://localhost:5173/tools)，即可使用全部工具。

本地预览生产版本：

```sh
npm run build
npm run preview
```

预览地址为 [localhost:4173/tools](http://localhost:4173/tools)。

## 部署

### Vercel（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FLittleSunX%2FWind-DevTools-&project-name=wind-devtools&repository-name=wind-devtools)

1. 点击上方 **Deploy** 按钮。
2. 登录 Vercel，按提示将项目保存到自己的 GitHub 仓库。
3. 确认框架为 **Vite**，构建命令为 `npm run build`，输出目录为 `dist`。
4. 点击 **Deploy**，等待构建完成即可访问。

> 正式上线后，将 `SITE_URL` 设置为实际站点地址并重新部署，以生成搜索引擎收录配置。未设置时，默认禁止收录。

部署已有仓库、自托管和 Umami 配置，见 [部署指南](docs/deployment.md)。

## 文档

| 文档                            | 内容                                   |
| ------------------------------- | -------------------------------------- |
| [使用指南](docs/usage.md)       | 快捷操作、输入格式、隐私与工具使用范围 |
| [部署指南](docs/deployment.md)  | Vercel、静态托管、域名与可选统计       |
| [开发指南](docs/development.md) | 技术栈、项目结构、测试命令与新增工具   |

工具输入与处理结果只留在浏览器中，刷新后不自动恢复。JWT 解析不验证签名；启用可选统计时，仅发送允许的页面与操作信息，详见使用指南。

---

<div align="center">

发现问题，或有想用的工具？[提交 Issue](https://github.com/LittleSunX/Wind-DevTools-/issues)。

**把时间留给创造。**

</div>
