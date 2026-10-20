import { MAX_CAPTION, MAX_NAME, buildPack, decodePack, encodePack, imageOf, quizToPersona, validatePack } from "./core.js";
import { downloadZip, drawSticker, isWeChat, loadImage } from "./render.js";

const $ = (id) => document.getElementById(id);
const refs = Object.fromEntries(["app-status", "quiz", "question-body", "question-count", "question-progress", "question-note", "previous", "next", "result", "result-title", "result-description", "nickname", "name-error", "sticker-grid", "download", "share", "action-status", "route-error", "save-note", "share-fallback", "share-link"].map((id) => [id, $(id)]));
const freshAnswers = () => ({ extras: [] });
const rotations = [-4, 3, -2, 4, -3, 2, -2, 3];
let library;
let answers = freshAnswers();
let question = 0;
let pack = null;
let renderEpoch = 0;
let pending = 0;
let downloading = false;
let nameError = false;
const errors = new Set();
const renderErrors = new Set();
const canvases = new Map();
const images = new Map();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function questionSpec() {
  const specs = [
    { key: "character", title: "你的本命是？", subtitle: "总有一个，一想到就有熟悉的感觉。", options: library.characters.map((c) => ({ value: c.id, label: c.name, image: imageOf(`r:${c.id}:ok`, library) })) },
    { key: "when", title: "一般什么时候去？", subtitle: "先不管今天，想想最像你的那个时间。", options: [{ value: "early", label: "早八前", detail: "Before 9:30" }, { value: "noon", label: "中午", detail: "Lunch break" }, { value: "night", label: "晚上九点后", detail: "After hours" }, { value: "any", label: "看心情", detail: "Whenever" }] },
    { key: "fries", title: "说到薯条，你是？", subtitle: "一位老朋友，还是随缘见个面。", options: [{ value: true, label: "每次都要", detail: "Always there" }, { value: false, label: "看心情", detail: "Sometimes" }] },
    { key: "spicy", title: "吃辣吗？", subtitle: "口味这种事，自己说了算。", options: [{ value: true, label: "要辣的", detail: "A little fire" }, { value: false, label: "不吃辣", detail: "Keep it mild" }] },
    { key: "extras", title: "还有哪些像你？", subtitle: "可以多选，也可以都不选。最多把四个习惯做成贴纸。", multi: true, options: library.traits.filter((t) => ["group_host", "weekend", "coffee_lover", "sweet_tooth"].includes(t.id)).map((t) => ({ value: t.id, label: ({ group_host: "常给大家组局", weekend: "周末才去", coffee_lover: "离不开咖啡", sweet_tooth: "要来点甜的" })[t.id], detail: ({ group_host: "Together", weekend: "Weekend only", coffee_lover: "Coffee first", sweet_tooth: "Something sweet" })[t.id] })) },
  ];
  return specs[question];
}

function renderQuestion(focus = false) {
  const spec = questionSpec();
  refs["question-count"].textContent = `${String(question + 1).padStart(2, "0")} / 05`;
  refs["question-progress"].style.width = `${(question + 1) * 20}%`;
  refs.previous.hidden = question === 0;
  refs.next.textContent = question === 4 ? "做成我的贴纸 ↗" : "下一题 →";
  refs.next.disabled = !spec.multi && answers[spec.key] === undefined;
  refs["question-note"].textContent = question === 4 ? "按定义顺序保留最多 4 个习惯" : "这里没有标准答案";
  const heading = element("h3", "question-title", spec.title);
  heading.id = "question-title";
  heading.tabIndex = -1;
  const options = element("fieldset", `options${question > 0 ? " text-options" : ""}${spec.options.length === 2 ? " two-options" : ""}`);
  options.setAttribute("aria-labelledby", heading.id);
  options.style.marginLeft = "0";
  options.style.marginRight = "0";
  options.style.padding = "0";
  for (const [index, option] of spec.options.entries()) {
    const label = element("label", "option");
    label.style.setProperty("--rotation", `${rotations[index]}deg`);
    const input = document.createElement("input");
    input.type = spec.multi ? "checkbox" : "radio";
    input.name = spec.key;
    input.value = String(option.value);
    input.checked = spec.multi ? answers.extras.includes(option.value) : answers[spec.key] === option.value;
    input.addEventListener("change", () => {
      if (spec.multi) answers.extras = Array.from(options.querySelectorAll("input:checked"), (node) => node.value);
      else answers[spec.key] = option.value;
      refs.next.disabled = false;
    });
    label.append(input);
    if (option.image) {
      const img = element("img");
      img.src = `stickers/img/${option.image}`;
      img.alt = "";
      img.width = img.height = 160;
      img.decoding = "async";
      label.append(img);
    }
    const name = element("span", "option-name", option.label);
    name.prepend(element("span", "selection-dot"));
    label.append(name);
    if (option.detail) label.append(element("span", "option-detail", option.detail));
    options.append(label);
  }
  refs["question-body"].replaceChildren(heading, element("p", "question-subtitle", spec.subtitle), options);
  if (focus) heading.focus({ preventScroll: true });
}

function updateActions() {
  const blocked = pending > 0 || downloading || errors.size > 0 || renderErrors.size > 0 || nameError || !pack;
  refs.download.disabled = blocked;
  refs.share.disabled = blocked;
  refs["sticker-grid"].setAttribute("aria-busy", String(pending > 0));
}

function rememberPack() {
  if (pack && !errors.size && !nameError) history.replaceState(null, "", `#p=${encodePack(pack, library)}`);
}

async function sourceImage(id) {
  const filename = imageOf(id, library);
  if (!images.has(filename)) images.set(filename, loadImage(`stickers/img/${filename}`).catch((error) => { images.delete(filename); throw error; }));
  return images.get(filename);
}

async function paintSticker(index, item, epoch) {
  const sticker = pack.stickers[index];
  const caption = sticker.caption;
  pending += 1;
  updateActions();
  try {
    const canvas = await drawSticker(await sourceImage(sticker.id), caption);
    if (epoch !== renderEpoch || pack.stickers[index]?.caption !== caption) return;
    canvases.set(sticker.id, canvas);
    const image = item.querySelector(".sticker-image");
    image.src = canvas.toDataURL("image/png");
    image.alt = caption;
    image.hidden = false;
    if (!errors.has(index)) item.querySelector(".field-error").textContent = "";
    renderErrors.delete(index);
  } catch {
    if (epoch !== renderEpoch) return;
    renderErrors.add(index);
    if (!errors.has(index)) item.querySelector(".field-error").textContent = "这张贴纸没展开。请刷新重试，暂时不能导出不完整的一套。";
  } finally {
    // 旧一轮绘制不参与新一轮计数。
    if (epoch === renderEpoch) { pending -= 1; updateActions(); }
  }
}

async function showResult(nextPack, { focus = true } = {}) {
  validatePack(nextPack, library);
  pack = nextPack;
  renderEpoch += 1;
  const epoch = renderEpoch;
  pending = 0;
  errors.clear();
  renderErrors.clear();
  canvases.clear();
  nameError = false;
  refs["name-error"].textContent = "";
  refs.nickname.removeAttribute("aria-invalid");
  refs.nickname.value = pack.name;
  refs.quiz.hidden = true;
  refs.result.hidden = false;
  refs["action-status"].textContent = "";
  refs["share-fallback"].hidden = true;
  updateResultTitle();
  refs["sticker-grid"].replaceChildren();
  const jobs = [];
  for (const [index, sticker] of pack.stickers.entries()) {
    const item = element("article", "sticker-item");
    item.dataset.stickerId = sticker.id;
    item.style.setProperty("--rotation", `${rotations[index % rotations.length]}deg`);
    const img = element("img", "sticker-image");
    img.width = img.height = 240;
    img.alt = sticker.caption;
    img.hidden = true;
    const label = element("label", "caption-label", `第 ${index + 1} 张 · 点下面改字`);
    const input = element("input", "caption-input");
    input.type = "text";
    input.id = `caption-${index}`;
    input.value = sticker.caption;
    input.maxLength = 40;
    input.autocomplete = "off";
    input.setAttribute("aria-describedby", `caption-error-${index}`);
    label.htmlFor = input.id;
    const error = element("p", "field-error");
    error.id = `caption-error-${index}`;
    error.setAttribute("aria-live", "polite");
    input.addEventListener("input", () => {
      const candidate = { ...pack, stickers: pack.stickers.map((s, i) => i === index ? { ...s, caption: input.value } : s) };
      try {
        validatePack(candidate, library);
        pack = candidate;
        errors.delete(index);
        input.removeAttribute("aria-invalid");
        error.textContent = "";
        rememberPack();
        void paintSticker(index, item, epoch);
      } catch (err) {
        errors.add(index);
        input.setAttribute("aria-invalid", "true");
        error.textContent = [...input.value].length > MAX_CAPTION ? "配字最多 8 个字，短一点更好读。" : err.message;
      }
      updateActions();
    });
    item.append(img, label, input, error);
    refs["sticker-grid"].append(item);
    jobs.push(paintSticker(index, item, epoch));
  }
  updateActions();
  if (focus) { refs.result.scrollIntoView({ block: "start", behavior: "smooth" }); refs["result-title"].focus({ preventScroll: true }); }
  await Promise.all(jobs);
}

function updateResultTitle() {
  refs["result-title"].textContent = pack.name ? `${pack.name}的麦门贴贴` : "你的麦门贴贴";
  const character = library.characters.find((c) => c.id === pack.character);
  const count = pack.stickers.length;
  refs["result-description"].textContent = `${character.name}是你的本命。这 ${count} 张，替你在群里说两句。`;
}

function showQuiz({ reset = false, focus = false } = {}) {
  renderEpoch += 1;
  pending = 0;
  refs.result.hidden = true;
  refs.quiz.hidden = false;
  if (reset) { answers = freshAnswers(); question = 0; }
  renderQuestion(focus);
}

async function readRoute() {
  refs["route-error"].hidden = true;
  if (location.hash.startsWith("#p=")) {
    try {
      await showResult(decodePack(location.hash.slice(3), library), { focus: false });
      refs.result.scrollIntoView({ block: "start", behavior: "instant" });
    }
    catch {
      const message = element("span", "", "这条贴纸链接没能展开，可能不完整或格式不对。 ");
      const link = element("a", "", "先玩一下，做套新的 →");
      link.href = "#play";
      refs["route-error"].replaceChildren(message, link);
      refs["route-error"].hidden = false;
      showQuiz({ reset: true });
    }
  } else if (location.hash === "#play" && refs.quiz.hidden) showQuiz();
}

refs.previous.addEventListener("click", () => { if (question > 0) { question -= 1; renderQuestion(true); } });
refs.next.addEventListener("click", () => {
  if (question < 4) { question += 1; renderQuestion(true); }
  else {
    const nextPack = buildPack(quizToPersona(answers, library), library);
    history.pushState(null, "", `#p=${encodePack(nextPack, library)}`);
    void showResult(nextPack);
  }
});
$("restart").addEventListener("click", () => { history.pushState(null, "", "#play"); showQuiz({ reset: true, focus: true }); $("play").scrollIntoView({ block: "start", behavior: "smooth" }); });
refs.nickname.addEventListener("input", () => {
  try {
    const candidate = { ...pack, name: refs.nickname.value };
    validatePack(candidate, library);
    pack = candidate;
    nameError = false;
    refs["name-error"].textContent = "";
    refs.nickname.removeAttribute("aria-invalid");
    updateResultTitle();
    rememberPack();
  } catch {
    nameError = true;
    refs.nickname.setAttribute("aria-invalid", "true");
    refs["name-error"].textContent = `昵称最多 ${MAX_NAME} 个字。`;
  }
  updateActions();
});

async function copyText(text) {
  if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
  let timer;
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("clipboard timeout")), 3000); }),
    ]);
  } finally { clearTimeout(timer); }
}

refs.share.addEventListener("click", async () => {
  if (refs.share.disabled) return;
  const link = `${library.site}#p=${encodePack(pack, library)}`;
  refs.share.disabled = true;
  try { await copyText(link); refs["action-status"].textContent = "链接复制好了，发给朋友看看。"; refs["share-fallback"].hidden = true; }
  catch { refs["share-link"].value = link; refs["share-fallback"].hidden = false; refs["share-link"].focus(); refs["share-link"].select(); refs["action-status"].textContent = "浏览器没有允许自动复制，可以手动复制下方链接。"; }
  finally { updateActions(); }
});
const safeFilename = (text) => text.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "").replace(/\.+/g, "").trim().slice(0, 32) || "贴纸";
refs.download.addEventListener("click", async () => {
  if (refs.download.disabled) return;
  downloading = true;
  updateActions();
  refs["action-status"].textContent = "正在把这一套装进小纸袋…";
  try {
    const files = pack.stickers.map((s, i) => ({ name: `${String(i + 1).padStart(2, "0")}-${safeFilename(s.caption)}.png`, canvas: canvases.get(s.id) }));
    if (files.some((f) => !f.canvas)) throw new Error("还有贴纸没展开，请稍后重试");
    await downloadZip(files, `麦门贴贴-${safeFilename(pack.name || library.characters.find((c) => c.id === pack.character).name)}.zip`);
    refs["action-status"].textContent = "纸袋打包好了。如果没有弹出下载，也可以长按单张保存。";
  } catch (err) { refs["action-status"].textContent = err.message || "没能下载，请长按单张保存或稍后重试。"; }
  finally { downloading = false; updateActions(); }
});
$("copy-install").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try { await copyText("npx skills add huyanxius/maimen-tietie"); button.textContent = "已复制 ✓"; }
  catch { button.textContent = "请选中左侧命令复制"; }
});

async function start() {
  try {
    const response = await fetch("stickers/library.json");
    if (!response.ok) throw new Error("library request failed");
    library = await response.json();
    if (library.version !== 1 || !Array.isArray(library.characters) || !Array.isArray(library.traits) || !Array.isArray(library.reactions)) throw new Error("unsupported library");
    refs["app-status"].hidden = true;
    if (isWeChat()) { refs.download.hidden = true; refs["save-note"].textContent = "长按图片保存，再在微信聊天里添加到表情。微信内不提供 ZIP 下载。"; }
    showQuiz();
    await readRoute();
    addEventListener("hashchange", () => void readRoute());
    addEventListener("popstate", () => void readRoute());
  } catch {
    refs["app-status"].textContent = "贴纸页暂时没展开，请检查网络后刷新。问答不需要登录或提供任何 Token。";
  }
}
void start();
