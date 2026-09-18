export const tools = [
  {
    id: "code-image",
    name: "代码画布",
    category: "创作与分享",
    icon: "⌘",
    description: "将代码转为精美图片。实时预览，一键导出高清 PNG。",
    tags: ["语法高亮", "图片导出"],
    hint: "本地生成图片，不上传代码。",
    example: "",
  },
  {
    id: "json",
    name: "JSON 格式化",
    category: "数据处理",
    icon: "{ }",
    description: "让复杂数据，清晰有序。格式化、压缩与校验 JSON。",
    tags: ["格式化", "压缩", "校验"],
    hint: "保留大整数精度，重复键会明确报错。",
    example:
      '{"name":"Wind","version":1,"features":["简单","免费","本地处理"],"ready":true}',
  },
  {
    id: "timestamp",
    name: "时间戳转换",
    category: "日期与时间",
    icon: "◷",
    description: "在时间戳与日期之间轻松转换，支持秒和毫秒。",
    tags: ["秒 / 毫秒", "UTC / 本地"],
    hint: "显式选择单位和时区，避免时间偏差。",
    example: "1789344000000",
  },
  {
    id: "jwt",
    name: "JWT 解析",
    category: "数据处理",
    icon: "◇",
    description: "快速查看 Header、Payload 和 Token 时间信息。",
    tags: ["Header", "Payload", "过期检查"],
    hint: "仅解码内容，不验证签名；请勿粘贴敏感 Token。",
    example:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiV2luZCIsImlhdCI6MTc4OTM0NDAwMCwiZXhwIjoxODkzNDU2MDAwfQ.demo",
  },
  {
    id: "sql",
    name: "SQL 格式化",
    category: "数据库",
    icon: "≡",
    description: "整理查询语句，让每一层逻辑都更容易阅读。",
    tags: ["MySQL", "PostgreSQL", "Oracle"],
    hint: "格式化不代表语法有效或可以执行。首发暂不提供 SQL 压缩。",
    example:
      "select u.id, u.name, count(o.id) as orders from users u left join orders o on u.id = o.user_id where u.active = 1 group by u.id, u.name order by orders desc;",
  },
  {
    id: "cron",
    name: "Cron 表达式",
    category: "日期与时间",
    icon: "↻",
    description: "生成常用计划，查看字段含义和未来执行时间。",
    tags: ["Linux", "Quartz", "执行时间"],
    hint: "Quartz 支持常用 6 字段；不支持年份和 L、W、#。",
    example: "0 */5 * * * ?",
  },
] as const;
export type ToolId = (typeof tools)[number]["id"];
export const categories = [
  "全部工具",
  "数据处理",
  "日期与时间",
  "数据库",
  "创作与分享",
];
