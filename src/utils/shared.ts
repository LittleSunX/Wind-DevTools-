export type Options = {
  action?: string;
  indent?: string;
  dialect?: string;
  keyword?: string;
  unit?: string;
  zone?: string;
  direction?: string;
  mode?: string;
};
export const MAX_BYTES = 5 * 1024 * 1024;
export function checkInput(input: string) {
  if (!input.trim()) throw new Error("请先输入需要处理的内容。");
  if (new TextEncoder().encode(input).length > MAX_BYTES)
    throw new Error("输入超过 5 MiB，请拆分后再处理。");
}
