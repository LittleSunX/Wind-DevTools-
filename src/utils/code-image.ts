export type Segment = { text: string; type: string };
export type ImageOptions = {
  theme: string;
  background: string;
  color: string;
  fontSize: number;
  padding: number;
  scale: number;
  lineNumbers: boolean;
  windowBar: boolean;
  title: string;
};
export const sampleCode = `// 让代码，也有好看的表达。
interface Developer {
  name: string;
  tools: string[];
}

const wind: Developer = {
  name: "Wind",
  tools: ["Build", "Create", "Share"],
};

console.log("Hello, developer!", wind);`;
export const languageGroups = [
  {
    label: "前端",
    items: [
      ["typescript", "TypeScript"],
      ["javascript", "JavaScript"],
      ["jsx", "JSX"],
      ["tsx", "TSX"],
      ["markup", "HTML"],
      ["css", "CSS"],
      ["vue", "Vue"],
    ],
  },
  {
    label: "后端与应用",
    items: [
      ["java", "Java"],
      ["python", "Python"],
      ["go", "Go"],
      ["rust", "Rust"],
      ["c", "C"],
      ["cpp", "C++"],
      ["csharp", "C#"],
      ["php", "PHP"],
      ["ruby", "Ruby"],
      ["kotlin", "Kotlin"],
      ["swift", "Swift"],
    ],
  },
  {
    label: "脚本与配置",
    items: [
      ["bash", "Bash"],
      ["powershell", "PowerShell"],
      ["json", "JSON"],
      ["yaml", "YAML"],
      ["toml", "TOML"],
      ["xml", "XML"],
      ["docker", "Dockerfile"],
      ["markdown", "Markdown"],
    ],
  },
  {
    label: "其他",
    items: [
      ["sql", "SQL"],
      ["plain", "纯文本"],
    ],
  },
];
export const languages = languageGroups.flatMap((group) => group.items);
export const imagePresets = [
  {
    name: "午夜蓝",
    theme: "night",
    background: "blue",
    padding: 48,
    fontSize: 18,
  },
  {
    name: "暖日落",
    theme: "graphite",
    background: "sunset",
    padding: 48,
    fontSize: 18,
  },
  {
    name: "极简白",
    theme: "light",
    background: "slate",
    padding: 32,
    fontSize: 16,
  },
  {
    name: "透明底",
    theme: "graphite",
    background: "transparent",
    padding: 32,
    fontSize: 18,
  },
];
export const defaults: ImageOptions = {
  theme: "night",
  background: "blue",
  color: "#5269d8",
  fontSize: 18,
  padding: 48,
  scale: 2,
  lineNumbers: true,
  windowBar: true,
  title: "hello.ts",
};
export function validateCode(code: string) {
  if (!code.trim()) throw new Error("请输入代码，或加载示例。");
  if (code.length > 12000)
    throw new Error("代码画布最多支持 12,000 个字符，请拆分代码。");
  if (code.split(/\r\n|\r|\n/).length > 160)
    throw new Error("最多支持 160 行，请拆分代码。");
}
export function splitSegments(segments: Segment[]): Segment[][] {
  const lines: Segment[][] = [[]];
  for (const seg of segments) {
    const parts = seg.text
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, "    ")
      .split("\n");
    parts.forEach((text, i) => {
      if (i) lines.push([]);
      if (text) lines[lines.length - 1].push({ text, type: seg.type });
    });
  }
  return lines;
}
const themes: Record<
  string,
  { bg: string; text: string; muted: string; colors: Record<string, string> }
> = {
  night: {
    bg: "#171d2d",
    text: "#d9e3f0",
    muted: "#69768c",
    colors: {
      keyword: "#c3a6ff",
      string: "#a8deb4",
      comment: "#7b879d",
      number: "#f2b77e",
      boolean: "#f2b77e",
      function: "#8bbfff",
      operator: "#8fd4e4",
      punctuation: "#9aaac1",
      "class-name": "#f4d68a",
      property: "#9fcbff",
      tag: "#ec9fad",
    },
  },
  light: {
    bg: "#ffffff",
    text: "#303b50",
    muted: "#8a94a5",
    colors: {
      keyword: "#7948b9",
      string: "#237b52",
      comment: "#738096",
      number: "#ae5b26",
      boolean: "#ae5b26",
      function: "#285cba",
      operator: "#29718b",
      punctuation: "#63728a",
      "class-name": "#966812",
      property: "#285cba",
      tag: "#a83d62",
    },
  },
  graphite: {
    bg: "#202124",
    text: "#e5e5e7",
    muted: "#8c9098",
    colors: {
      keyword: "#e8a5cf",
      string: "#a5d6ac",
      comment: "#92969f",
      number: "#e8bd8e",
      boolean: "#e8bd8e",
      function: "#a8c7fa",
      operator: "#99d8dc",
      punctuation: "#b0b4be",
      "class-name": "#e8cd8d",
      property: "#a8c7fa",
      tag: "#e8a5cf",
    },
  },
};
export function drawCode(
  canvas: HTMLCanvasElement,
  segments: Segment[],
  o: ImageOptions,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法创建图片。");
  const lines = splitSegments(segments);
  const font = `${o.fontSize}px Consolas, "SFMono-Regular", "Liberation Mono", monospace`;
  ctx.font = font;
  const gutter = o.lineNumbers
    ? ctx.measureText(String(lines.length)).width + 24
    : 0;
  const content = Math.max(
    ...lines.map(
      (line) => ctx.measureText(line.map((s) => s.text).join("")).width,
    ),
  );
  const panelWidth = Math.max(420, Math.ceil(content + gutter + 56));
  const lineHeight = Math.ceil(o.fontSize * 1.65);
  const header = o.windowBar ? 48 : 0;
  const panelHeight = header + 48 + lines.length * lineHeight;
  const width = panelWidth + o.padding * 2,
    height = panelHeight + o.padding * 2;
  if (width > 2400) throw new Error("单行代码太长，请手动换行或缩小字号。");
  if (width * height * o.scale * o.scale > 16000000 || height * o.scale > 12000)
    throw new Error("图片尺寸过大，请减少代码、字号、内边距或导出倍率。");
  canvas.width = width * o.scale;
  canvas.height = height * o.scale;
  ctx.scale(o.scale, o.scale);
  if (o.background !== "transparent") {
    if (o.background === "solid") {
      ctx.fillStyle = o.color;
    } else {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      const stops =
        o.background === "sunset"
          ? ["#f4b8a5", "#ba9cdf"]
          : o.background === "slate"
            ? ["#dce3ef", "#a8b8d0"]
            : ["#8ea9ef", "#b8a2e6"];
      gradient.addColorStop(0, stops[0]);
      gradient.addColorStop(1, stops[1]);
      ctx.fillStyle = gradient;
    }
    ctx.fillRect(0, 0, width, height);
  }
  const t = themes[o.theme] || themes.night;
  ctx.save();
  ctx.shadowColor = "#17203a33";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = t.bg;
  ctx.beginPath();
  ctx.roundRect(o.padding, o.padding, panelWidth, panelHeight, 12);
  ctx.fill();
  ctx.restore();
  if (o.windowBar) {
    ["#ff6058", "#ffbd2e", "#28c840"].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(o.padding + 22 + i * 18, o.padding + 24, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = t.muted;
    ctx.font = "12px sans-serif";
    let title = o.title;
    while (title && ctx.measureText(title).width > panelWidth - 180)
      title = title.slice(0, -1);
    if (title !== o.title) title += "…";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, o.padding + panelWidth / 2, o.padding + 24);
    ctx.textAlign = "left";
  }
  ctx.font = font;
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    const y = o.padding + header + 24 + i * lineHeight;
    let x = o.padding + 28;
    if (o.lineNumbers) {
      ctx.fillStyle = t.muted;
      ctx.textAlign = "right";
      ctx.fillText(String(i + 1), x + gutter - 24, y);
      ctx.textAlign = "left";
      x += gutter;
    }
    for (const seg of line) {
      ctx.fillStyle = t.colors[seg.type] || t.text;
      ctx.fillText(seg.text, x, y);
      x += ctx.measureText(seg.text).width;
    }
  });
  return { width: canvas.width, height: canvas.height };
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("图片生成失败，请降低导出倍率。")),
      "image/png",
    ),
  );
}
