// 底图与配字只在浏览器合成，不发送到服务器。
export const STICKER_SIZE = 240;
const CAPTION_FONT = '"ZCOOL KuaiLe", "PingFang SC", sans-serif';
const INK = "#232724";

export function isWeChat(userAgent = navigator.userAgent) {
  return /MicroMessenger/i.test(userAgent);
}

export async function loadImage(src) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  return img;
}

export async function drawSticker(img, caption, size = STICKER_SIZE) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("这个浏览器暂不支持贴纸合成，请换一个浏览器试试");
  const pad = Math.round(size * 0.04);
  const boxH = Math.round(size * 0.76);
  const scale = Math.min((size - pad * 2) / img.naturalWidth, (boxH - pad) / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (size - w) / 2, pad + (boxH - pad - h) / 2, w, h);
  let fontSize = Math.round(size * 0.16);
  // 外部字体不可用时仍可导出，不让字体网络错误卡住全部贴纸。
  try { await document.fonts.load(`${fontSize}px ${CAPTION_FONT}`, caption); } catch { /* system fallback */ }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (;;) {
    ctx.font = `${fontSize}px ${CAPTION_FONT}`;
    if (ctx.measureText(caption).width <= size - pad * 2 - 8 || fontSize <= 12) break;
    fontSize -= 2;
  }
  const stroke = Math.max(4, Math.round(fontSize * 0.28));
  const descent = ctx.measureText(caption).actualBoundingBoxDescent || Math.round(fontSize * 0.16);
  const y = size - pad - Math.max(descent, 3) - stroke / 2;
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(caption, size / 2, y);
  ctx.fillStyle = INK;
  ctx.fillText(caption, size / 2, y);
  return canvas;
}

async function ensureZip() {
  if (!window.JSZip) await import("../vendor/jszip-3.10.1.min.js");
  if (!window.JSZip) throw new Error("下载组件没有载入，可以先长按单张保存，再重试下载");
  return window.JSZip;
}

export async function downloadZip(files, zipName) {
  const JSZip = await ensureZip();
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.canvas.toDataURL("image/png").split(",")[1], { base64: true });
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  try { a.click(); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return blob;
}
