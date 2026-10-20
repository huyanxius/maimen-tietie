// 麦门贴贴网页的纯逻辑：不碰 DOM，Node 里能直接测。
// 与 scripts/tietie.py 一一对应，链接只带四个公开字段，格式两边必须能互相解开。

export const MAX_TRAITS = 4;
export const MAX_CAPTION = 8;
export const MAX_NAME = 12;
export const MAX_TOKEN = 8192;
export const BANNED = ["暴食", "撑死", "吃到吐", "胖死", "猛吃", "狂吃"];
const IDENTIFIER = "[a-z][a-z0-9_]{0,63}";
// 用真正的串尾判断，避免 JS 的 $ 接受最后一个换行符之前的位置。
const CHARACTER_RE = new RegExp(`^${IDENTIFIER}(?![\\s\\S])`);
const REACTION_RE = new RegExp(`^r:${IDENTIFIER}:${IDENTIFIER}(?![\\s\\S])`);
const TRAIT_RE = new RegExp(`^t:${IDENTIFIER}(?![\\s\\S])`);
const PACK_FIELDS = ["v", "name", "character", "stickers"];
const STICKER_FIELDS = ["id", "caption"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function requireText(value, label, nonempty = false) {
  if (typeof value !== "string") throw new Error(`${label}必须是有效的 Unicode 文字`);
  // TextEncoder 会悄悄把孤立代理项变成 �，必须在编码前明确拒绝。
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code >= 0xd800 && code <= 0xdfff) throw new Error(`${label}必须是有效的 Unicode 文字`);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) throw new Error(`${label}不能包含换行或控制字符`);
  }
  if (nonempty && !value.trim()) throw new Error(`${label}不能为空`);
  return value;
}

function hasExactFields(value, fields) {
  return isRecord(value) && Reflect.ownKeys(value).length === fields.length
    && fields.every((key) => Object.hasOwn(value, key));
}

// 问答模式可省略未选项；陌生角色仍回落汉堡，习惯按唯一的 library 顺序去重、截到四个。
export function quizToPersona(answers, library) {
  if (!isRecord(answers)) throw new Error("问答答案必须是对象");
  if (answers.character !== undefined) requireText(answers.character, "本命角色");
  if (answers.when !== undefined && !["early", "noon", "night", "any"].includes(answers.when)) throw new Error("请选择有效的时间段");
  for (const key of ["fries", "spicy"]) {
    if (answers[key] !== undefined && typeof answers[key] !== "boolean") throw new Error("问答选项必须是布尔值");
  }
  if (answers.extras !== undefined && (!Array.isArray(answers.extras) || answers.extras.some((extra) => typeof extra !== "string"))) throw new Error("额外习惯必须是文字列表");
  const ids = new Set();
  if (answers.when === "early") ids.add("early_bird");
  if (answers.when === "night") ids.add("night_owl");
  if (answers.fries) ids.add("fries_loyalist");
  if (answers.spicy) ids.add("spicy");
  for (const extra of answers.extras || []) ids.add(extra);
  const traits = library.traits.filter((t) => ids.has(t.id)).slice(0, MAX_TRAITS).map((t) => ({ id: t.id, evidence: "问答" }));
  const known = library.characters.some((c) => c.id === answers.character);
  return { order_count: 0, character: known ? answers.character : "burger", character_counts: {}, traits };
}

export function buildPack(persona, library, name = "") {
  if (!isRecord(persona) || !Array.isArray(persona.traits)) throw new Error("人设需要角色和习惯列表");
  if (persona.traits.length > MAX_TRAITS) throw new Error(`最多 ${MAX_TRAITS} 个习惯`);
  const char = persona.character;
  if (typeof char !== "string" || !library.characters.some((c) => c.id === char)) throw new Error("没有这个本命角色");
  requireText(name, "名字");
  if (persona.traits.some((t) => !isRecord(t) || !library.traits.some((x) => x.id === t.id))) throw new Error("没有这个习惯");
  const stickers = library.reactions.map((r) => ({ id: `r:${char}:${r.id}`, caption: r.caption }));
  const captions = Object.fromEntries(library.traits.map((t) => [t.id, t.caption]));
  for (const trait of persona.traits) stickers.push({ id: `t:${trait.id}`, caption: captions[trait.id] });
  return validatePack({ v: 1, name: [...name].slice(0, MAX_NAME).join(""), character: char, stickers }, library);
}

export function imageOf(stickerId, library) {
  requireText(stickerId, "贴纸编号");
  if (REACTION_RE.test(stickerId)) {
    const [, character, reaction] = stickerId.split(":");
    if (library.characters.some((c) => c.id === character) && library.reactions.some((r) => r.id === reaction)) return `${character}-${reaction}.png`;
  }
  if (TRAIT_RE.test(stickerId)) {
    const trait = library.traits.find((t) => t.id === stickerId.slice(2));
    if (trait) return trait.image;
  }
  throw new Error("没有这张贴纸");
}

function validatePackShape(pack) {
  if (!hasExactFields(pack, PACK_FIELDS)) throw new Error("贴纸包只能包含 v、name、character、stickers 四个字段");
  if (pack.v !== 1) throw new Error("只认 v=1 的贴纸包");
  requireText(pack.name, "名字");
  if ([...pack.name].length > MAX_NAME) throw new Error(`名字最多 ${MAX_NAME} 个字`);
  requireText(pack.character, "本命角色");
  if (!CHARACTER_RE.test(pack.character)) throw new Error("本命角色编号格式不正确");
  if (!Array.isArray(pack.stickers) || pack.stickers.length < 1 || pack.stickers.length > 16) throw new Error("一套 1 到 16 张");
  const seen = new Set();
  for (const sticker of pack.stickers) {
    if (!hasExactFields(sticker, STICKER_FIELDS)) throw new Error("每张贴纸只能包含 id 和 caption 两个字段");
    const id = requireText(sticker.id, "贴纸编号");
    if (!REACTION_RE.test(id) && !TRAIT_RE.test(id)) throw new Error("贴纸编号格式不正确");
    if (seen.has(id)) throw new Error("同一张贴纸不能重复");
    seen.add(id);
    const caption = requireText(sticker.caption, "配字", true);
    if ([...caption].length < 1 || [...caption].length > MAX_CAPTION) throw new Error(`配字要 1 到 ${MAX_CAPTION} 个字`);
    if (BANNED.some((word) => caption.includes(word))) throw new Error("配字含有不合规的词");
  }
  return pack;
}

export function validatePack(pack, library) {
  validatePackShape(pack);
  if (!library.characters.some((c) => c.id === pack.character)) throw new Error("没有这个本命角色");
  for (const sticker of pack.stickers) imageOf(sticker.id, library);
  return pack;
}

function bytesToToken(bytes) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function encodePack(pack, library) {
  library === undefined ? validatePackShape(pack) : validatePack(pack, library);
  // 创建新对象以固定顺序，不依赖调用方的键插入顺序，也不修改调用方对象。
  const canonical = { v: 1, name: pack.name, character: pack.character, stickers: pack.stickers.map((s) => ({ id: s.id, caption: s.caption })) };
  const token = bytesToToken(new TextEncoder().encode(JSON.stringify(canonical)));
  if (token.length > MAX_TOKEN) throw new Error("贴纸包链接太长");
  return token;
}

export function decodePack(token, library) {
  if (typeof token !== "string" || token.length < 1 || token.length > MAX_TOKEN || !/^[A-Za-z0-9_-]+$/.test(token) || token.length % 4 === 1) throw new Error("贴纸包链接格式不正确或太长");
  let pack;
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (token.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytesToToken(bytes) !== token) throw new Error("不是规范的 base64url");
    pack = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
  } catch {
    throw new Error("贴纸包链接不是有效的 UTF-8 JSON");
  }
  return library === undefined ? validatePackShape(pack) : validatePack(pack, library);
}
