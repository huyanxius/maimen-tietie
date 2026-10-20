import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_SIZE, drawSticker, isWeChat } from './render.js';

test('WeChat is detected without hiding ZIP for ordinary browsers', () => {
  assert.equal(isWeChat('Mozilla/5.0 MicroMessenger/8.0.1'), true);
  assert.equal(isWeChat('Mozilla/5.0 micromessenger/8.0'), true);
  assert.equal(isWeChat('Mozilla/5.0 Chrome/154 Safari/537.36'), false);
  assert.equal(isWeChat(''), false);
});

function mockDocument(fontError = false) {
  const calls = [];
  const ctx = {
    font: '',
    drawImage: (...args) => calls.push(['image', ...args]),
    measureText: (text) => ({ width: [...text].length * parseInt(ctx.font), actualBoundingBoxDescent: 5 }),
    strokeText: (...args) => calls.push(['outline', ...args]),
    fillText: (...args) => calls.push(['caption', ...args]),
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  return { calls, ctx, canvas, document: { createElement: () => canvas, fonts: { load: async () => { if (fontError) throw new Error('offline font'); } } } };
}

test('renderer produces a square 240px canvas with fitted eight-character caption', async () => {
  const old = globalThis.document;
  const mock = mockDocument();
  globalThis.document = mock.document;
  try {
    const canvas = await drawSticker({ naturalWidth: 512, naturalHeight: 512 }, '一二三四五六七八');
    assert.equal(STICKER_SIZE, 240);
    assert.equal(canvas.width, 240);
    assert.equal(canvas.height, 240);
    assert.ok(parseInt(mock.ctx.font) <= 26);
    assert.ok(mock.calls.find(([name]) => name === 'caption')[3] < 230);
    assert.equal(mock.calls.find(([name]) => name === 'outline')[1], '一二三四五六七八');
  } finally { globalThis.document = old; }
});

test('font failure still yields usable export with system fallback', async () => {
  const old = globalThis.document;
  const mock = mockDocument(true);
  globalThis.document = mock.document;
  try {
    await drawSticker({ naturalWidth: 512, naturalHeight: 512 }, '收到');
    assert.equal(mock.calls.filter(([name]) => name === 'caption').length, 1);
  } finally { globalThis.document = old; }
});
