import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPack, decodePack, encodePack, imageOf, quizToPersona, validatePack } from "./core.js";

const library = JSON.parse(readFileSync(new URL("../stickers/library.json", import.meta.url), "utf-8"));
// 由 tests/test_tietie.py 的 test_encode_matches_fixture 用 Python 生成，两边必须一致
const FIXTURE_TOKEN = "eyJ2IjoxLCJuYW1lIjoi5bCP546LIiwiY2hhcmFjdGVyIjoiZnJpZXMiLCJzdGlja2VycyI6W3siaWQiOiJyOmZyaWVzOm9rIiwiY2FwdGlvbiI6IuaUtuWIsCJ9LHsiaWQiOiJ0OmVhcmx5X2JpcmQiLCJjYXB0aW9uIjoi5pep5YWr57ut5ZG95LitIn1dfQ";
const FIXTURE_PACK = { v: 1, name: "小王", character: "fries", stickers: [{ id: "r:fries:ok", caption: "收到" }, { id: "t:early_bird", caption: "早八续命中" }] };

test("decodes the token python produced", () => {
  assert.deepEqual(decodePack(FIXTURE_TOKEN), FIXTURE_PACK);
});

test("encodes to the same token python produced", () => {
  assert.equal(encodePack(FIXTURE_PACK), FIXTURE_TOKEN);
});

test("quiz picks traits in library order, at most four", () => {
  const p = quizToPersona({ character: "fries", when: "night", fries: true, spicy: true, extras: ["sweet_tooth", "weekend", "group_host"] }, library);
  assert.equal(p.character, "fries");
  assert.deepEqual(p.traits.map((t) => t.id), ["night_owl", "fries_loyalist", "spicy", "group_host"]);
});

test("unknown character falls back to burger", () => {
  assert.equal(quizToPersona({ character: "pizza" }, library).character, "burger");
});

test("pack has four reactions then the traits", () => {
  const pack = buildPack({ character: "cola", traits: [{ id: "weekend" }] }, library, "小李");
  assert.deepEqual(pack.stickers.map((s) => s.id), ["r:cola:ok", "r:cola:go", "r:cola:hungry", "r:cola:night", "t:weekend"]);
  assert.equal(pack.stickers[4].caption, "周末见");
});

test("image file names", () => {
  assert.equal(imageOf("r:cone:night", library), "cone-night.png");
  assert.equal(imageOf("t:spicy", library), "trait-spicy.png");
  assert.throws(() => imageOf("r:pizza:ok", library));
});

test("validate rejects long and banned captions", () => {
  assert.throws(() => validatePack({ v: 1, name: "", character: "burger", stickers: [{ id: "r:burger:ok", caption: "一二三四五六七八九" }] }, library));
  assert.throws(() => validatePack({ v: 1, name: "", character: "burger", stickers: [{ id: "r:burger:ok", caption: "吃到吐" }] }, library));
  assert.doesNotThrow(() => validatePack(FIXTURE_PACK, library));
});

// 全部都是合成边界样例，不加载账户、地址或真实订单。
const basePack = () => ({ v: 1, name: "小王", character: "fries", stickers: [{ id: "r:fries:ok", caption: "收到" }] });
const rawToken = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value), "utf8").toString("base64url");
function assertInvalid(pack) {
  assert.throws(() => validatePack(pack, library));
  assert.throws(() => encodePack(pack));
  assert.throws(() => decodePack(rawToken(pack)));
}

test("pack requires an object with exactly four public fields", () => {
  for (const value of [null, [], "pack", 1, true]) assertInvalid(value);
  for (const field of Object.keys(basePack())) {
    const pack = basePack();
    delete pack[field];
    assertInvalid(pack);
  }
});

test("unknown fields cannot leak into an encoded link", () => {
  for (const field of ["orders", "address", "token", "items", "time", "__proto__"]) {
    const pack = basePack();
    Object.defineProperty(pack, field, { value: "synthetic-private-field", enumerable: true });
    assertInvalid(pack);
  }
  const pack = basePack();
  pack.stickers[0].address = "synthetic-private-field";
  assertInvalid(pack);
});

test("version is numeric one, never boolean or a string", () => {
  for (const v of [true, false, "1", null, 0, 2, NaN, Infinity]) {
    assert.throws(() => validatePack({ ...basePack(), v }, library));
    assert.throws(() => encodePack({ ...basePack(), v }));
  }
});

test("pack field types are checked before using them", () => {
  for (const [field, values] of [["name", [null, 1, [], {}]], ["character", [null, 1, [], "", "fries\n"]], ["stickers", [null, "", {}, 1]]]) {
    for (const value of values) assertInvalid({ ...basePack(), [field]: value });
  }
});

test("stickers require exactly id and caption strings", () => {
  for (const sticker of [null, [], {}, { id: "r:fries:ok" }, { caption: "收到" }, { id: null, caption: "收到" }, { id: "r:fries:ok", caption: null }, { id: "r:fries:ok", caption: ["收"] }]) {
    assertInvalid({ ...basePack(), stickers: [sticker] });
  }
});

test("library membership applies to character and sticker IDs", () => {
  for (const pack of [{ ...basePack(), character: "pizza" }, { ...basePack(), stickers: [{ id: "t:unknown", caption: "收到" }] }]) {
    assert.throws(() => validatePack(pack, library));
    assert.throws(() => encodePack(pack, library));
    assert.throws(() => decodePack(rawToken(pack), library));
  }
});

test("sticker grammar is exact, with no suffix or whitespace", () => {
  for (const id of ["r:fries:ok:extra", "t:spicy:extra", "t:spicy\n", "r:fries:ok\n", "r:fries", "r::ok", "r:fries:../ok", "t:../spicy", "t:SPICY", " t:spicy"]) {
    assertInvalid({ ...basePack(), stickers: [{ id, caption: "收到" }] });
    assert.throws(() => imageOf(id, library));
  }
});

test("duplicate stickers are rejected", () => {
  assertInvalid({ ...basePack(), stickers: [...basePack().stickers, ...basePack().stickers] });
});

test("custom pack count accepts 1 and 16, rejects 0 and 17", () => {
  const stickers = library.characters.flatMap((c) => library.reactions.map((r) => ({ id: `r:${c.id}:${r.id}`, caption: "好" })));
  for (const count of [1, 16]) assert.doesNotThrow(() => validatePack({ ...basePack(), stickers: stickers.slice(0, count) }, library));
  for (const count of [0, 17]) assertInvalid({ ...basePack(), stickers: stickers.slice(0, count) });
});

test("captions count Unicode codepoints, not UTF-16 units", () => {
  for (const caption of ["好", "😀".repeat(8), "一二三四五六七八"]) {
    const pack = { ...basePack(), stickers: [{ id: "r:fries:ok", caption }] };
    assert.deepEqual(decodePack(encodePack(pack)), pack);
  }
  for (const caption of ["", "😀".repeat(9), "一二三四五六七八九"]) assertInvalid({ ...basePack(), stickers: [{ id: "r:fries:ok", caption }] });
});

test("all banned caption terms are rejected", () => {
  for (const caption of ["暴食", "撑死", "吃到吐", "胖死", "猛吃", "狂吃"]) assertInvalid({ ...basePack(), stickers: [{ id: "r:fries:ok", caption: `别${caption}` }] });
});

test("name permits twelve codepoints and builder truncates at twelve", () => {
  assert.doesNotThrow(() => validatePack({ ...basePack(), name: "😀".repeat(12) }, library));
  assertInvalid({ ...basePack(), name: "😀".repeat(13) });
  assert.equal(buildPack({ character: "fries", traits: [] }, library, "😀".repeat(13)).name, "😀".repeat(12));
});

test("lone surrogate codepoints are rejected before encoding", () => {
  for (const value of ["\ud800", "\udfff"]) {
    assertInvalid({ ...basePack(), name: value });
    assertInvalid({ ...basePack(), stickers: [{ id: "r:fries:ok", caption: value }] });
    assert.throws(() => buildPack({ character: "fries", traits: [] }, library, value));
  }
});

test("encoding fixes key order without mutating the input", () => {
  const pack = { stickers: [{ caption: "收到", id: "r:fries:ok" }], character: "fries", name: "小王", v: 1 };
  assert.equal(encodePack(pack), encodePack(basePack()));
  assert.deepEqual(Object.keys(pack), ["stickers", "character", "name", "v"]);
  assert.deepEqual(Object.keys(pack.stickers[0]), ["caption", "id"]);
});

test("builder rejects invalid persona structures, traits and name types", () => {
  for (const persona of [null, {}, { character: "pizza", traits: [] }, { character: "fries", traits: [null] }, { character: "fries", traits: [{ id: [] }] }, { character: "fries", traits: Array(5).fill({ id: "weekend" }) }]) assert.throws(() => buildPack(persona, library));
  assert.throws(() => buildPack({ character: "fries", traits: [] }, library, 1));
});

test("quiz rejects malformed answers rather than truthy coercion", () => {
  for (const answers of [null, [], 1, { character: 1 }, { when: "later" }, { fries: "yes" }, { spicy: 1 }, { extras: "weekend" }, { extras: [null] }]) assert.throws(() => quizToPersona(answers, library));
  assert.deepEqual(quizToPersona({}, library).traits, []);
});

test("quiz deduplicates and ignores unknown extra traits in library order", () => {
  const persona = quizToPersona({ character: "coffee", extras: ["sweet_tooth", "unknown", "coffee_lover", "coffee_lover"] }, library);
  assert.deepEqual(persona.traits.map((t) => t.id), ["coffee_lover", "sweet_tooth"]);
});

test("decode rejects invalid token alphabet, padding and length", () => {
  for (const token of [null, 1, [], "", "a", "abc=", "+abc", "/abc", " abc", FIXTURE_TOKEN + "\n", "é", "%7B", "a".repeat(8193)]) assert.throws(() => decodePack(token));
});

test("decode rejects malformed UTF-8 instead of replacing it", () => {
  for (const bytes of [[0xff], [0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xef, 0xbb, 0xbf, 0x7b, 0x7d]]) assert.throws(() => decodePack(Buffer.from(bytes).toString("base64url")));
  // 无效字节藏在合法 JSON 字符串中也不能被 TextDecoder 替换后放行。
  const bytes = Buffer.concat([Buffer.from('{"v":1,"name":"'), Buffer.from([0xff]), Buffer.from('","character":"fries","stickers":[{"id":"r:fries:ok","caption":"好"}]}')]);
  assert.throws(() => decodePack(bytes.toString("base64url")));
});

test("decode does not accept arbitrary JSON values or malformed JSON", () => {
  for (const text of ["not json", '{"v":NaN}', "null", "[]", "1", '"text"', '{"orders":[]}']) assert.throws(() => decodePack(rawToken(text)));
});

test("decode rejects noncanonical unused base64 bits but permits JSON whitespace", () => {
  let text = JSON.stringify(basePack());
  while (Buffer.byteLength(text, "utf8") % 3 === 0) text += " ";
  const token = rawToken(text);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const changed = token.slice(0, -1) + alphabet[alphabet.indexOf(token.at(-1)) + 1];
  assert.throws(() => decodePack(changed));
  assert.deepEqual(decodePack(token), basePack());
});
