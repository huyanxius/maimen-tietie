#!/usr/bin/env python3
"""麦门贴贴：从麦当劳订单里读出你的「麦门人设」，配成一套表情包的分享链接。

这里只做确定性的部分：订单 → 本命角色和习惯（带证据）→ 贴纸清单 → 链接。
画图在网页里做（docs/app/），链接只带角色、贴纸编号和配字，不带任何订单数据。
贴纸、角色、习惯的定义都在 docs/stickers/library.json，网页和这个脚本读同一份。
"""
from __future__ import annotations

import argparse
import base64
import binascii
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY_FILE = ROOT / "docs" / "stickers" / "library.json"
MIN_ORDERS = 3
MAX_TRAITS = 4
MAX_CAPTION = 8
MAX_NAME = 12
MAX_TOKEN = 8192
PACK_FIELDS = {"v", "name", "character", "stickers"}
STICKER_FIELDS = {"id", "caption"}
IDENTIFIER = r"[a-z][a-z0-9_]{0,63}"
# 比赛规则禁止宣扬不健康饮食：配字里不许出现这些词
BANNED = ["暴食", "撑死", "吃到吐", "胖死", "猛吃", "狂吃"]

# (习惯 id, 判断这一单是否命中, 最低占比, 证据模板)。占比 = 命中单数 / 总单数，且至少命中 2 单。
TRAIT_RULES = [
    ("early_bird", lambda o: 5 <= o["dt"].hour < 9 or (o["dt"].hour == 9 and o["dt"].minute < 30), 0.3, "{k}/{n} 单在早上 9:30 前"),
    ("night_owl", lambda o: o["dt"].hour >= 21 or o["dt"].hour < 5, 0.3, "{k}/{n} 单在晚上 9 点以后"),
    ("fries_loyalist", lambda o: any("薯条" in it["name"] for it in o["items"]), 0.6, "{k}/{n} 单都有薯条"),
    ("spicy", lambda o: any("辣" in it["name"] for it in o["items"]), 0.4, "{k}/{n} 单点了辣的"),
    ("group_host", lambda o: sum(it.get("qty", 1) for it in o["items"]) >= 4, 0.3, "{k}/{n} 单一次点了 4 份以上"),
    ("weekend", lambda o: o["dt"].weekday() >= 5, 0.5, "{k}/{n} 单在周末"),
    ("coffee_lover", lambda o: "coffee" in o["chars"], 0.3, "{k}/{n} 单有咖啡"),
    ("sweet_tooth", lambda o: "cone" in o["chars"], 0.4, "{k}/{n} 单有甜品"),
]


def load_library(path=LIBRARY_FILE):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def classify(name, library):
    """餐品名 → 角色 id。按 library 里角色的顺序匹配，先命中先算，所以更具体的词要排前面。"""
    _require_text(name, "餐品名", nonempty=True)
    for c in library["characters"]:
        if any(k in name for k in c["match"]):
            return c["id"]
    return None


def build_persona(orders, library):
    """orders: [{"time": "2026-10-01 07:40", "items": [{"name": "猪柳麦满分", "qty": 1}]}]"""
    orders = validate_orders(orders)
    if len(orders) < MIN_ORDERS:
        raise ValueError(f"只有 {len(orders)} 单，至少要 {MIN_ORDERS} 单才看得出习惯，先用网页的问答模式")
    rows = []
    counts = {}
    for o in orders:
        chars = set()
        for it in o["items"]:
            cid = classify(it["name"], library)
            if cid:
                chars.add(cid)
                counts[cid] = counts.get(cid, 0) + it.get("qty", 1)
        rows.append({"dt": datetime.fromisoformat(o["time"]), "items": o["items"], "chars": chars})
    order_of = {c["id"]: i for i, c in enumerate(library["characters"])}
    character = min(counts, key=lambda c: (-counts[c], order_of[c])) if counts else "burger"
    n = len(rows)
    hits = []
    for idx, (tid, test, threshold, evidence) in enumerate(TRAIT_RULES):
        k = sum(1 for r in rows if test(r))
        if k >= 2 and k / n >= threshold:
            hits.append((-(k / n), idx, {"id": tid, "evidence": evidence.format(k=k, n=n)}))
    traits = [h[2] for h in sorted(hits)[:MAX_TRAITS]]
    return {"order_count": n, "character": character, "character_counts": counts, "traits": traits}


def build_pack(persona, library, name=""):
    """本命角色的 4 个反应贴 + 命中的习惯贴（最多 4 个），一套 4–8 张。"""
    if not isinstance(persona, dict) or not isinstance(persona.get("traits"), list):
        raise ValueError("人设需要角色和习惯列表")
    if len(persona["traits"]) > MAX_TRAITS:
        raise ValueError(f"最多 {MAX_TRAITS} 个习惯")
    char = persona.get("character")
    if not isinstance(char, str) or char not in {c["id"] for c in library["characters"]}:
        raise ValueError("没有这个本命角色")
    _require_text(name, "名字")
    if any(not isinstance(t, dict) or not isinstance(t.get("id"), str) or t["id"] not in {x["id"] for x in library["traits"]} for t in persona["traits"]):
        raise ValueError("没有这个习惯")
    stickers = [{"id": f"r:{char}:{r['id']}", "caption": r["caption"]} for r in library["reactions"]]
    captions = {t["id"]: t["caption"] for t in library["traits"]}
    stickers += [{"id": f"t:{t['id']}", "caption": captions[t["id"]]} for t in persona["traits"]]
    return validate_pack({"v": 1, "name": name[:MAX_NAME], "character": char, "stickers": stickers}, library)


def _require_text(value, label, nonempty=False):
    """Python len 和 JS 的 [...text].length 都按 Unicode 码点计数，不接受孤立代理项。"""
    if not isinstance(value, str) or any(0xD800 <= ord(c) <= 0xDFFF for c in value):
        raise ValueError(f"{label}必须是有效的 Unicode 文字")
    if nonempty and not value.strip():
        raise ValueError(f"{label}不能为空")
    return value


def validate_orders(orders):
    """只接收规范化订单；time 为北京时间的无时区 YYYY-MM-DD HH:MM，不猜测时区。"""
    if not isinstance(orders, list):
        raise ValueError("orders 必须是订单列表")
    for o in orders:
        if not isinstance(o, dict) or not isinstance(o.get("items"), list) or not o["items"]:
            raise ValueError("每单需要 time 和非空 items 列表")
        time = o.get("time")
        if not isinstance(time, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}", time):
            raise ValueError("订单时间请用北京时间 YYYY-MM-DD HH:MM，不加时区")
        try:
            datetime.fromisoformat(time)
        except ValueError:
            raise ValueError("订单时间不是有效的日期或时刻") from None
        for item in o["items"]:
            if not isinstance(item, dict):
                raise ValueError("items 中每份餐品必须是对象")
            _require_text(item.get("name"), "餐品名", nonempty=True)
            qty = item.get("qty", 1)
            if type(qty) is not int or qty <= 0:
                raise ValueError("餐品 qty 必须是正整数")
    return orders


def image_of(sticker_id, library):
    """贴纸编号 → docs/stickers/img/ 下的文件名。认不出的编号抛 ValueError。"""
    _require_text(sticker_id, "贴纸编号")
    if re.fullmatch(rf"r:{IDENTIFIER}:{IDENTIFIER}", sticker_id):
        _, char, reaction = sticker_id.split(":")
        if char in {c["id"] for c in library["characters"]} and reaction in {r["id"] for r in library["reactions"]}:
            return f"{char}-{reaction}.png"
    if re.fullmatch(rf"t:{IDENTIFIER}", sticker_id):
        for t in library["traits"]:
            if t["id"] == sticker_id[2:]:
                return t["image"]
    raise ValueError("没有这张贴纸")


def _validate_pack_shape(pack):
    # 只允许公开的四个字段。不要把订单、地址或其他未知字段带进分享链接。
    if not isinstance(pack, dict) or set(pack) != PACK_FIELDS:
        raise ValueError("贴纸包只能包含 v、name、character、stickers 四个字段")
    if type(pack["v"]) not in (int, float) or pack["v"] != 1:
        raise ValueError("只认 v=1 的贴纸包")
    _require_text(pack["name"], "名字")
    if len(pack["name"]) > MAX_NAME:
        raise ValueError(f"名字最多 {MAX_NAME} 个字")
    char = _require_text(pack["character"], "本命角色")
    if not re.fullmatch(IDENTIFIER, char):
        raise ValueError("本命角色编号格式不正确")
    stickers = pack["stickers"]
    if not isinstance(stickers, list) or not 1 <= len(stickers) <= 16:
        raise ValueError("一套 1 到 16 张")
    seen = set()
    for sticker in stickers:
        if not isinstance(sticker, dict) or set(sticker) != STICKER_FIELDS:
            raise ValueError("每张贴纸只能包含 id 和 caption 两个字段")
        sid = _require_text(sticker["id"], "贴纸编号")
        if not re.fullmatch(rf"(?:r:{IDENTIFIER}:{IDENTIFIER}|t:{IDENTIFIER})", sid):
            raise ValueError("贴纸编号格式不正确")
        if sid in seen:
            raise ValueError("同一张贴纸不能重复")
        seen.add(sid)
        cap = _require_text(sticker["caption"], "配字")
        if not 1 <= len(cap) <= MAX_CAPTION:
            raise ValueError(f"配字要 1 到 {MAX_CAPTION} 个字")
        if any(word in cap for word in BANNED):
            raise ValueError("配字含有不合规的词")
    return pack


def validate_pack(pack, library):
    _validate_pack_shape(pack)
    if pack["character"] not in {c["id"] for c in library["characters"]}:
        raise ValueError("没有这个本命角色")
    for sticker in pack["stickers"]:
        image_of(sticker["id"], library)
    return pack


def encode_pack(pack, library=None):
    """固定字段顺序，跨 Python / JS 编码一致；未知字段一律拒绝，不静默泄漏。"""
    validate_pack(pack, library) if library is not None else _validate_pack_shape(pack)
    canonical = {"v": 1, "name": pack["name"], "character": pack["character"],
                 "stickers": [{"id": s["id"], "caption": s["caption"]} for s in pack["stickers"]]}
    raw = json.dumps(canonical, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    token = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    if len(token) > MAX_TOKEN:
        raise ValueError("贴纸包链接太长")
    return token


def _reject_json_constant(value):
    raise ValueError("JSON 不支持 NaN 或 Infinity")


def decode_pack(token, library=None):
    """只接收无填充的规范 base64url、严格 UTF-8 和规范贴纸包，不接受宽松容错解码。"""
    if not isinstance(token, str) or not 1 <= len(token) <= MAX_TOKEN or not re.fullmatch(r"[A-Za-z0-9_-]+", token) or len(token) % 4 == 1:
        raise ValueError("贴纸包链接格式不正确或太长")
    try:
        raw = base64.b64decode(token + "=" * (-len(token) % 4), altchars=b"-_", validate=True)
        if base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=") != token:
            raise ValueError("不是规范的 base64url")
        pack = json.loads(raw.decode("utf-8"), parse_constant=_reject_json_constant)
    except (binascii.Error, UnicodeError, ValueError, RecursionError):
        raise ValueError("贴纸包链接不是有效的 UTF-8 JSON") from None
    return validate_pack(pack, library) if library is not None else _validate_pack_shape(pack)


def pack_link(pack, library):
    return f"{library['site']}#p={encode_pack(pack, library)}"


class FriendlyArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError(f"命令参数不正确：{message}")


def main(argv=None):
    ap = FriendlyArgumentParser(description="麦门贴贴：订单 → 人设 → 表情包链接")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p1 = sub.add_parser("persona", help="只看人设")
    p1.add_argument("orders")
    p2 = sub.add_parser("link", help="从订单生成贴纸包链接")
    p2.add_argument("orders")
    p2.add_argument("--name", default="")
    p3 = sub.add_parser("encode", help="把改过配字的贴纸包 JSON 重新生成链接")
    p3.add_argument("pack")
    try:
        args = ap.parse_args(argv)
        library = load_library()
        if args.cmd == "encode":
            pack = json.loads(Path(args.pack).read_text(encoding="utf-8"))
            print(pack_link(pack, library))
            return 0
        data = json.loads(Path(args.orders).read_text(encoding="utf-8"))
        if not isinstance(data, dict) or "orders" not in data:
            raise ValueError("输入文件需要包含 orders 列表")
        orders = data["orders"]
        persona = build_persona(orders, library)
        if args.cmd == "persona":
            print(json.dumps(persona, ensure_ascii=False, indent=2))
            return 0
        pack = build_pack(persona, library, args.name)
        print(json.dumps({"persona": persona, "pack": pack, "link": pack_link(pack, library)}, ensure_ascii=False, indent=2))
        return 0
    except (OSError, UnicodeError):
        print("生成失败：无法读取输入文件，请检查路径、权限和 UTF-8 编码", file=sys.stderr)
        return 1
    except (KeyError, ValueError, TypeError, RecursionError) as e:
        print(f"生成失败：{e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
