import { canvasFonts } from "./code-image";
const loads = new Map<string, Promise<void>>();
export function loadCanvasFont(id: string): Promise<void> {
  const font = canvasFonts.find((item) => item.id === id) ?? canvasFonts[0];
  if (!font.file) return Promise.resolve();
  const existing = loads.get(font.id);
  if (existing) return existing;
  const loading = new FontFace(font.family, `url("/fonts/${font.file}")`)
    .load()
    .then((face) => {
      document.fonts.add(face);
    })
    .catch(() => {
      loads.delete(font.id);
      throw new Error(
        "字体加载失败，请在外观设置中切换为系统等宽字体，或刷新重试。",
      );
    });
  loads.set(font.id, loading);
  return loading;
}
