# 麦门贴贴 maimen-tietie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参加「麦当劳程序员创意开发大赛」的 Skill + 在线网页：读用户的麦当劳订单，找出本命餐和吃麦当劳的习惯，生成一套能加进微信的纸贴纸表情包；没有麦当劳账号的人也能在网页上答 5 道题玩出一套。

**Architecture:** 三块。① `scripts/tietie.py`（纯 Python 标准库）：订单 → 人设（本命角色 + 带证据的习惯）→ 贴纸清单 → 分享链接，确定性、有测试。② `docs/`（GitHub Pages 静态站）：问答模式和「打开链接」模式，用 canvas 把贴纸底图和配字合成 240×240 透明 PNG，打包下载。③ 贴纸底图：Codex 用自带生图工具按 logo-to-stickers 的方法生成的 32 张透明纸贴纸。贴纸、角色、习惯的定义只在 `docs/stickers/library.json` 一处，脚本和网页读同一份。链接只带角色、贴纸编号、配字和昵称，不带任何订单数据。

**Tech Stack:** Python 3.9+ 标准库；原生 HTML/CSS/ES modules（无构建）；JSZip 3.10.1（cdn.jsdelivr.net）；Google Fonts「ZCOOL KuaiLe」只用于贴纸配字；Node 24 `node:test` 测前端纯逻辑；Codex 内置生图；GitHub CLI。

---

## 比赛背景（实现前必读）

- 官方仓库 `M-China/mcd-developer-innovation-challenge`，规则在它的 `README.md` 和 `activityGuidelines.md`。**报名截止 2026-10-25 23:59，2026-10-26 00:00 按 GitHub Star 数定榜，前 100 名进榜。** 排名不看作品质量，但陌生人点星看作品，所以网页和贴纸要好看好玩。**目标：10-22 晚上做完，最晚 10-23 晚上公开。**
- 必备文件（文件名不可改）：`README.md`（项目介绍、安装方法、使用示例、目标用户）、`CONTEST_DECLARATION.md`（**官方文件原样复制，一字不改**）、`MCP_INTEGRATION.md`（实际用到的 MCP Server、Tool、调用流程、业务价值）、源代码。
- 禁止：刷星；宣扬不健康饮食（配字和画面都不拿「吃了多少」当梗，不涉及体重和身材）；可能对麦当劳造成不良影响的内容。**角色全部原创，画面里不出现麦当劳 logo、金拱门、麦当劳叔叔、任何品牌字样。**
- 一个 GitHub 账号多个参赛项目只算 Star 最多的那个。之前写的 `~/Developer/pinmai`（拼单分账）留给周末的 WaytoAGI 比赛，**这次不要碰它**。
- 麦当劳 MCP Token 由用户本人手机号在 `https://open.mcd.cn/mcp` 申请，放进环境变量 `MCD_MCP_TOKEN`，绝不写进仓库。Task 8 之前用不到。
- GitHub 账号 `huyanxius`，仓库名 `maimen-tietie`，网页地址 `https://huyanxius.github.io/maimen-tietie/`（GitHub Pages，来源 `main` 分支 `/docs`）。
- **用户已授权一路做下去（2026-10-21 00:50，原话「不要让他停下来，我睡觉了，他能做多少做多少吧」）**：Task 9 的公开仓库、推送、开 Pages、发报名 Issue 直接做，不用等。公开前的底线：两套测试全绿；网页在 390px 和 1280px 下都实际看过；贴纸至少完成 Task 4 优先级里的 16 张。达不到底线就先别公开，把卡在哪写进 `plans/STATUS.md`。
- 首个版本在 `main` 上完成（还没远端，走不了 PR）；公开之后的改动走分支 + PR。commit 用 Angular 风格，不加 `Co-Authored-By` 或任何 AI 尾巴。
- 已知事实：麦当劳一张订单只能用一张券（别人实测接口报 600022），本项目默认不下单，只在「再来一单」可选流程里用到。
- 微信表情规范：主图 240×240，形象轮廓要有白色描边、不能贴着画布边缘。上架官方表情商店要 GIF，本项目只做个人「添加到表情」用的透明 PNG。

## 文件结构

```
maimen-tietie/
├── AGENTS.md
├── .gitignore
├── CONTEST_DECLARATION.md        # 官方参赛声明，原样复制
├── README.md
├── MCP_INTEGRATION.md
├── SKILL.md                      # Skill 本体，放根目录，整个仓库就是一个 Skill
├── scripts/tietie.py             # 订单 → 人设 → 贴纸包 → 链接
├── tests/
│   ├── fixtures/orders.json
│   └── test_tietie.py
├── docs/                         # GitHub Pages 站点根目录
│   ├── index.html
│   ├── styles.css
│   ├── app/
│   │   ├── core.js               # 纯逻辑：问答 → 人设、贴纸包、编码解码、校验
│   │   ├── core.test.mjs         # node --test
│   │   ├── render.js             # canvas 合成贴纸、打包下载
│   │   └── main.js               # 页面交互
│   └── stickers/
│       ├── library.json          # 唯一的贴纸定义
│       └── img/                  # 32 张透明 PNG 底图 + hero.png
└── plans/2026-10-21-maimen-tietie.md
```

## 贴纸包规则（脚本和网页共用）

- 一套 = 本命角色的 4 张反应贴（收到 / 冲 / 饿了 / 晚安）+ 命中的习惯贴（最多 4 张），共 4–8 张。
- 贴纸编号：反应贴 `r:<角色>:<反应>`，图片 `img/<角色>-<反应>.png`；习惯贴 `t:<习惯>`，图片见 library 里的 `image`。
- 本命角色：按订单里各角色出现的份数，最多的那个；并列时按 library 里角色的顺序；一个都没认出来就用汉堡。
- 习惯：至少命中 2 单且占比达到门槛才算，按占比从高到低取前 4 个，并列按规则顺序。每个习惯带一句证据，比如「3/5 单在早上 9:30 前」。
- 配字 1–8 个字，不得含 `BANNED` 里的词；昵称最多 12 个字。
- 链接：`https://huyanxius.github.io/maimen-tietie/#p=<token>`，token 是贴纸包紧凑 JSON（UTF-8）的 base64url（去掉 `=`）。Python 和 JS 必须编出同一个 token，测试里有同一个固定样例互相校验。

---

### Task 0: 初始化仓库

**Files:** Create `AGENTS.md`、`.gitignore`、`CONTEST_DECLARATION.md`；本计划已在 `plans/`。

- [ ] **Step 1: 初始化 git 并下载官方声明**

```bash
cd ~/Developer/maimen-tietie
git init -b main
gh api repos/M-China/mcd-developer-innovation-challenge/contents/CONTEST_DECLARATION.md --jq .content | base64 -d > CONTEST_DECLARATION.md
head -3 CONTEST_DECLARATION.md
```

Expected: 打印出声明开头的中文。之后任何任务都不改这个文件。

- [ ] **Step 2: 写 `.gitignore`**

```gitignore
__pycache__/
*.pyc
.env
*.local.json
.DS_Store
/tmp/
```

- [ ] **Step 3: 写 `AGENTS.md`**

```markdown
# maimen-tietie 仓库约定

- 参加「麦当劳程序员创意开发大赛」的 Skill + 网页，规则以 M-China/mcd-developer-innovation-challenge 为准。
- `CONTEST_DECLARATION.md` 是官方文件，不可修改。
- 贴纸、角色、习惯只在 `docs/stickers/library.json` 定义，脚本和网页都读它，别在代码里另写一份。
- `scripts/` 只用 Python 标准库，兼容 Python 3.9；`docs/` 不引入构建工具。
- 测试：`python3 -m unittest discover -s tests -v` 和 `node --test docs/app/core.test.mjs`，提交前都要全绿。
- Python 和 JS 对同一个贴纸包必须编出同一个链接 token，改编码逻辑要两边一起改。
- 链接和仓库文件里不得出现任何订单数据；MCP Token 只从环境变量 `MCD_MCP_TOKEN` 读取。
- 角色原创：不出现麦当劳 logo、金拱门、麦当劳叔叔、品牌字样；配字不拿「吃了多少」、体重、身材当梗。
- 网页改动必须在浏览器里看过手机宽度（390px）和桌面宽度（1280px）的实际渲染再提交。
- commit 用 Angular 风格，不加 Co-Authored-By 或任何 AI 尾巴；公开以后走分支 + PR。
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md .gitignore CONTEST_DECLARATION.md plans/
git commit -m "chore: init maimen-tietie with official contest declaration"
```

---

### Task 1: 贴纸定义 `library.json`

**Files:** Create `docs/stickers/library.json`

- [ ] **Step 1: 写文件**

```json
{
  "version": 1,
  "site": "https://huyanxius.github.io/maimen-tietie/",
  "characters": [
    {"id": "burger", "name": "汉堡", "match": ["巨无霸", "麦满分", "猪柳", "堡"]},
    {"id": "fries", "name": "薯条", "match": ["薯条", "薯饼", "薯"]},
    {"id": "nuggets", "name": "鸡块", "match": ["麦乐鸡", "鸡块", "鸡翅", "翅"]},
    {"id": "coffee", "name": "咖啡", "match": ["咖啡", "拿铁", "美式", "卡布", "麦咖啡", "McCafé"]},
    {"id": "cone", "name": "甜筒", "match": ["甜筒", "麦旋风", "圣代", "冰淇淋", "派"]},
    {"id": "cola", "name": "可乐", "match": ["可乐", "雪碧", "芬达", "橙汁", "饮"]}
  ],
  "reactions": [
    {"id": "ok", "caption": "收到"},
    {"id": "go", "caption": "冲"},
    {"id": "hungry", "caption": "饿了"},
    {"id": "night", "caption": "晚安"}
  ],
  "traits": [
    {"id": "early_bird", "name": "早八续命", "caption": "早八续命中", "image": "trait-early-bird.png"},
    {"id": "night_owl", "name": "深夜麦门", "caption": "夜里也营业", "image": "trait-night-owl.png"},
    {"id": "fries_loyalist", "name": "薯条常驻", "caption": "薯条必须有", "image": "trait-fries-loyalist.png"},
    {"id": "spicy", "name": "无辣不欢", "caption": "要辣的", "image": "trait-spicy.png"},
    {"id": "group_host", "name": "拼单发起人", "caption": "我来组局", "image": "trait-group-host.png"},
    {"id": "weekend", "name": "周末限定", "caption": "周末见", "image": "trait-weekend.png"},
    {"id": "coffee_lover", "name": "咖啡续航", "caption": "先来杯咖啡", "image": "trait-coffee-lover.png"},
    {"id": "sweet_tooth", "name": "甜品时间", "caption": "来点甜的", "image": "trait-sweet-tooth.png"}
  ]
}
```

角色的 `match` 关键词按顺序匹配、先命中先算，所以更具体的词放前面：「麦辣鸡腿堡」含「堡」归汉堡；咖啡排在可乐前面，免得「冰咖啡饮品」被「饮」字抢走。

- [ ] **Step 2: 校验 JSON**

Run: `python3 -c "import json;d=json.load(open('docs/stickers/library.json'));print(len(d['characters']),len(d['reactions']),len(d['traits']))"`
Expected: `6 4 8`

- [ ] **Step 3: Commit**

```bash
git add docs/stickers/library.json
git commit -m "feat: define sticker library"
```

---

### Task 2: `scripts/tietie.py`——订单 → 人设 → 链接

**Files:** Create `tests/fixtures/orders.json`、`tests/test_tietie.py`、`scripts/tietie.py`

- [ ] **Step 1: 写测试数据 `tests/fixtures/orders.json`**

```json
{"orders": [
  {"time": "2026-10-05 07:40", "items": [{"name": "猪柳麦满分", "qty": 1}, {"name": "薯饼", "qty": 1}]},
  {"time": "2026-10-06 08:55", "items": [{"name": "猪柳蛋麦满分", "qty": 1}, {"name": "热拿铁", "qty": 1}]},
  {"time": "2026-10-08 12:10", "items": [{"name": "麦辣鸡腿堡", "qty": 1}, {"name": "中薯条", "qty": 1}, {"name": "可口可乐", "qty": 1}]},
  {"time": "2026-10-11 22:30", "items": [{"name": "麦乐鸡 5 块", "qty": 1}, {"name": "中薯条", "qty": 1}]},
  {"time": "2026-10-13 07:20", "items": [{"name": "猪柳麦满分", "qty": 1}, {"name": "薯饼", "qty": 1}]}
]}
```

- [ ] **Step 2: 写失败的测试 `tests/test_tietie.py`**

```python
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import tietie  # noqa: E402

LIB = tietie.load_library()
ORDERS = json.loads((ROOT / "tests" / "fixtures" / "orders.json").read_text(encoding="utf-8"))["orders"]
# docs/app/core.test.mjs 里有同一个 token，网页和脚本必须对同一个包编出同一个链接
FIXTURE_PACK = {"v": 1, "name": "小王", "character": "fries",
                "stickers": [{"id": "r:fries:ok", "caption": "收到"}, {"id": "t:early_bird", "caption": "早八续命中"}]}
FIXTURE_TOKEN = "eyJ2IjoxLCJuYW1lIjoi5bCP546LIiwiY2hhcmFjdGVyIjoiZnJpZXMiLCJzdGlja2VycyI6W3siaWQiOiJyOmZyaWVzOm9rIiwiY2FwdGlvbiI6IuaUtuWIsCJ9LHsiaWQiOiJ0OmVhcmx5X2JpcmQiLCJjYXB0aW9uIjoi5pep5YWr57ut5ZG95LitIn1dfQ"


def order(time, *names):
    return {"time": time, "items": [{"name": n, "qty": 1} for n in names]}


class ClassifyTest(unittest.TestCase):
    def test_burger_wins_over_spicy_chicken(self):
        self.assertEqual(tietie.classify("麦辣鸡腿堡", LIB), "burger")

    def test_wings_are_nuggets(self):
        self.assertEqual(tietie.classify("麦辣鸡翅", LIB), "nuggets")

    def test_coffee_before_drinks(self):
        self.assertEqual(tietie.classify("冰咖啡饮品", LIB), "coffee")

    def test_unknown(self):
        self.assertIsNone(tietie.classify("纸巾", LIB))


class PersonaTest(unittest.TestCase):
    def test_fixture_persona(self):
        p = tietie.build_persona(ORDERS, LIB)
        self.assertEqual(p["character"], "burger")  # 汉堡和薯条都是 4，按 library 顺序汉堡在前
        self.assertEqual(p["traits"], [{"id": "early_bird", "evidence": "3/5 单在早上 9:30 前"}])

    def test_hash_browns_are_not_fries(self):
        p = tietie.build_persona(ORDERS, LIB)
        self.assertNotIn("fries_loyalist", [t["id"] for t in p["traits"]])

    def test_night_fries_weekend(self):
        orders = [
            order("2026-10-10 22:10", "麦乐鸡 5 块", "中薯条"),   # 周六
            order("2026-10-11 23:40", "麦乐鸡 10 块", "大薯条"),  # 周日
            order("2026-10-14 12:00", "巨无霸", "中薯条"),        # 周三
            order("2026-10-17 21:30", "麦乐鸡 5 块", "中薯条"),   # 周六
        ]
        p = tietie.build_persona(orders, LIB)
        self.assertEqual(p["character"], "fries")  # 薯条 4 次，麦乐鸡 3 次
        self.assertEqual([t["id"] for t in p["traits"]], ["fries_loyalist", "night_owl", "weekend"])
        self.assertEqual(p["traits"][0]["evidence"], "4/4 单都有薯条")

    def test_needs_three_orders(self):
        with self.assertRaises(ValueError):
            tietie.build_persona(ORDERS[:2], LIB)

    def test_at_most_four_traits(self):
        orders = [order(f"2026-10-{d} 07:00", "麦辣鸡腿堡", "中薯条", "热拿铁", "甜筒") for d in (10, 11, 17)]
        p = tietie.build_persona(orders, LIB)
        self.assertEqual(len(p["traits"]), 4)


class PackTest(unittest.TestCase):
    def test_reactions_then_traits(self):
        pack = tietie.build_pack(tietie.build_persona(ORDERS, LIB), LIB, "小王")
        self.assertEqual([s["id"] for s in pack["stickers"]],
                         ["r:burger:ok", "r:burger:go", "r:burger:hungry", "r:burger:night", "t:early_bird"])
        self.assertEqual(pack["stickers"][-1]["caption"], "早八续命中")

    def test_image_of(self):
        self.assertEqual(tietie.image_of("r:cone:night", LIB), "cone-night.png")
        self.assertEqual(tietie.image_of("t:spicy", LIB), "trait-spicy.png")
        with self.assertRaises(ValueError):
            tietie.image_of("r:pizza:ok", LIB)

    def test_validate_rejects_long_caption(self):
        bad = dict(FIXTURE_PACK, stickers=[{"id": "r:fries:ok", "caption": "一二三四五六七八九"}])
        with self.assertRaises(ValueError):
            tietie.validate_pack(bad, LIB)

    def test_validate_rejects_banned_word(self):
        bad = dict(FIXTURE_PACK, stickers=[{"id": "r:fries:ok", "caption": "吃到吐"}])
        with self.assertRaises(ValueError):
            tietie.validate_pack(bad, LIB)

    def test_encode_matches_fixture(self):
        self.assertEqual(tietie.encode_pack(FIXTURE_PACK), FIXTURE_TOKEN)

    def test_decode_round_trip(self):
        self.assertEqual(tietie.decode_pack(FIXTURE_TOKEN), FIXTURE_PACK)

    def test_link_contains_no_order_data(self):
        link = tietie.pack_link(tietie.build_pack(tietie.build_persona(ORDERS, LIB), LIB), LIB)
        decoded = tietie.decode_pack(link.split("#p=")[1])
        self.assertEqual(set(decoded), {"v", "name", "character", "stickers"})


class CliTest(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(ROOT / "scripts" / "tietie.py"), *args], capture_output=True, text=True)

    def test_link_command(self):
        r = self.run_cli("link", str(ROOT / "tests" / "fixtures" / "orders.json"), "--name", "小王")
        self.assertEqual(r.returncode, 0, r.stderr)
        out = json.loads(r.stdout)
        self.assertTrue(out["link"].startswith("https://huyanxius.github.io/maimen-tietie/#p="))

    def test_too_few_orders_exits_1(self):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump({"orders": ORDERS[:1]}, f, ensure_ascii=False)
        r = self.run_cli("link", f.name)
        self.assertEqual(r.returncode, 1)
        self.assertIn("生成失败", r.stderr)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: 跑测试，确认失败**

Run: `python3 -m unittest discover -s tests -v`
Expected: FAIL，`ModuleNotFoundError: No module named 'tietie'`

- [ ] **Step 4: 实现 `scripts/tietie.py`**

```python
#!/usr/bin/env python3
"""麦门贴贴：从麦当劳订单里读出你的「麦门人设」，配成一套表情包的分享链接。

这里只做确定性的部分：订单 → 本命角色和习惯（带证据）→ 贴纸清单 → 链接。
画图在网页里做（docs/app/），链接只带角色、贴纸编号和配字，不带任何订单数据。
贴纸、角色、习惯的定义都在 docs/stickers/library.json，网页和这个脚本读同一份。
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY_FILE = ROOT / "docs" / "stickers" / "library.json"
MIN_ORDERS = 3
MAX_TRAITS = 4
MAX_CAPTION = 8
MAX_NAME = 12
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
    for c in library["characters"]:
        if any(k in name for k in c["match"]):
            return c["id"]
    return None


def build_persona(orders, library):
    """orders: [{"time": "2026-10-01 07:40", "items": [{"name": "猪柳麦满分", "qty": 1}]}]"""
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
    char = persona["character"]
    stickers = [{"id": f"r:{char}:{r['id']}", "caption": r["caption"]} for r in library["reactions"]]
    captions = {t["id"]: t["caption"] for t in library["traits"]}
    stickers += [{"id": f"t:{t['id']}", "caption": captions[t["id"]]} for t in persona["traits"]]
    return {"v": 1, "name": name[:MAX_NAME], "character": char, "stickers": stickers}


def image_of(sticker_id, library):
    """贴纸编号 → docs/stickers/img/ 下的文件名。认不出的编号抛 ValueError。"""
    kind, _, rest = sticker_id.partition(":")
    if kind == "r":
        char, _, reaction = rest.partition(":")
        if char in {c["id"] for c in library["characters"]} and reaction in {r["id"] for r in library["reactions"]}:
            return f"{char}-{reaction}.png"
    if kind == "t":
        for t in library["traits"]:
            if t["id"] == rest:
                return t["image"]
    raise ValueError(f"没有这张贴纸：{sticker_id}")


def validate_pack(pack, library):
    if pack.get("v") != 1:
        raise ValueError("只认 v=1 的贴纸包")
    if len(pack.get("name", "")) > MAX_NAME:
        raise ValueError(f"名字最多 {MAX_NAME} 个字")
    if not 1 <= len(pack["stickers"]) <= 16:
        raise ValueError("一套 1 到 16 张")
    for s in pack["stickers"]:
        image_of(s["id"], library)
        cap = s["caption"]
        if not 1 <= len(cap) <= MAX_CAPTION:
            raise ValueError(f"配字「{cap}」要 1 到 {MAX_CAPTION} 个字")
        for w in BANNED:
            if w in cap:
                raise ValueError(f"配字「{cap}」含有不合规的词「{w}」")
    return pack


def encode_pack(pack):
    raw = json.dumps(pack, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_pack(token):
    pad = "=" * (-len(token) % 4)
    return json.loads(base64.urlsafe_b64decode(token + pad).decode("utf-8"))


def pack_link(pack, library):
    return f"{library['site']}#p={encode_pack(validate_pack(pack, library))}"


def main(argv=None):
    ap = argparse.ArgumentParser(description="麦门贴贴：订单 → 人设 → 表情包链接")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p1 = sub.add_parser("persona", help="只看人设")
    p1.add_argument("orders")
    p2 = sub.add_parser("link", help="从订单生成贴纸包链接")
    p2.add_argument("orders")
    p2.add_argument("--name", default="")
    p3 = sub.add_parser("encode", help="把改过配字的贴纸包 JSON 重新生成链接")
    p3.add_argument("pack")
    args = ap.parse_args(argv)
    library = load_library()
    try:
        if args.cmd == "encode":
            pack = json.loads(Path(args.pack).read_text(encoding="utf-8"))
            print(pack_link(pack, library))
            return 0
        orders = json.loads(Path(args.orders).read_text(encoding="utf-8"))["orders"]
        persona = build_persona(orders, library)
        if args.cmd == "persona":
            print(json.dumps(persona, ensure_ascii=False, indent=2))
            return 0
        pack = build_pack(persona, library, args.name)
        print(json.dumps({"persona": persona, "pack": pack, "link": pack_link(pack, library)}, ensure_ascii=False, indent=2))
        return 0
    except (KeyError, ValueError) as e:
        print(f"生成失败：{e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: 跑测试，确认通过**

Run: `python3 -m unittest discover -s tests -v`
Expected: 18 个测试全部 `ok`（这份代码已在 Python 3.9.6 上预跑通过）

Run: `python3 scripts/tietie.py link tests/fixtures/orders.json --name 小王`
Expected: 输出 JSON，`persona.character` 为 `burger`，`persona.traits` 只有 `early_bird`，`link` 以 `https://huyanxius.github.io/maimen-tietie/#p=` 开头。

- [ ] **Step 6: Commit**

```bash
git add scripts/tietie.py tests/
git commit -m "feat: derive persona and sticker pack link from orders"
```

---

### Task 3: 网页纯逻辑 `docs/app/core.js`

**Files:** Create `docs/app/core.test.mjs`、`docs/app/core.js`

- [ ] **Step 1: 写失败的测试 `docs/app/core.test.mjs`**

```js
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
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test docs/app/core.test.mjs`
Expected: FAIL，找不到 `./core.js`。注意：Node 24 下 `node --test` 后面要写具体文件，写目录会报错。

- [ ] **Step 3: 实现 `docs/app/core.js`**

```js
// 麦门贴贴网页的纯逻辑：不碰 DOM，Node 里能直接测。
// 贴纸编号、配字规则和 scripts/tietie.py 一一对应，链接格式两边必须能互相解开。

export const MAX_TRAITS = 4;
export const MAX_CAPTION = 8;
export const MAX_NAME = 12;
// 比赛规则禁止宣扬不健康饮食：配字里不许出现这些词（和 tietie.py 的 BANNED 保持一致）
export const BANNED = ["暴食", "撑死", "吃到吐", "胖死", "猛吃", "狂吃"];

// 问答模式：answers = { character: "fries", when: "early"|"noon"|"night"|"any",
//   fries: true|false, spicy: true|false, extras: ["group_host","weekend","coffee_lover","sweet_tooth"] }
export function quizToPersona(answers, library) {
  const ids = new Set();
  if (answers.when === "early") ids.add("early_bird");
  if (answers.when === "night") ids.add("night_owl");
  if (answers.fries) ids.add("fries_loyalist");
  if (answers.spicy) ids.add("spicy");
  for (const e of answers.extras || []) ids.add(e);
  // 按 library 里习惯的顺序取前 MAX_TRAITS 个，结果可复现
  const traits = library.traits.filter((t) => ids.has(t.id)).slice(0, MAX_TRAITS).map((t) => ({ id: t.id, evidence: "问答" }));
  const known = library.characters.some((c) => c.id === answers.character);
  return { order_count: 0, character: known ? answers.character : "burger", character_counts: {}, traits };
}

export function buildPack(persona, library, name = "") {
  const char = persona.character;
  const stickers = library.reactions.map((r) => ({ id: `r:${char}:${r.id}`, caption: r.caption }));
  const captions = Object.fromEntries(library.traits.map((t) => [t.id, t.caption]));
  for (const t of persona.traits) stickers.push({ id: `t:${t.id}`, caption: captions[t.id] });
  return { v: 1, name: [...name].slice(0, MAX_NAME).join(""), character: char, stickers };
}

export function imageOf(stickerId, library) {
  const [kind, a, b] = stickerId.split(":");
  if (kind === "r" && library.characters.some((c) => c.id === a) && library.reactions.some((r) => r.id === b)) {
    return `${a}-${b}.png`;
  }
  if (kind === "t") {
    const t = library.traits.find((x) => x.id === a);
    if (t) return t.image;
  }
  throw new Error(`没有这张贴纸：${stickerId}`);
}

export function validatePack(pack, library) {
  if (pack.v !== 1) throw new Error("只认 v=1 的贴纸包");
  if ([...(pack.name || "")].length > MAX_NAME) throw new Error(`名字最多 ${MAX_NAME} 个字`);
  if (!(pack.stickers.length >= 1 && pack.stickers.length <= 16)) throw new Error("一套 1 到 16 张");
  for (const s of pack.stickers) {
    imageOf(s.id, library);
    const n = [...s.caption].length;
    if (n < 1 || n > MAX_CAPTION) throw new Error(`配字「${s.caption}」要 1 到 ${MAX_CAPTION} 个字`);
    const bad = BANNED.find((w) => s.caption.includes(w));
    if (bad) throw new Error(`配字「${s.caption}」含有不合规的词「${bad}」`);
  }
  return pack;
}

export function encodePack(pack) {
  const bytes = new TextEncoder().encode(JSON.stringify(pack));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePack(token) {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (token.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --test docs/app/core.test.mjs`
Expected: 7 个测试全部通过（已在 Node 24.18 上预跑通过）。其中两个测试证明 Python 编出的 token 和 JS 互通。

- [ ] **Step 5: Commit**

```bash
git add docs/app/core.js docs/app/core.test.mjs
git commit -m "feat: add browser-side pack logic shared with python"
```

---

### Task 4: 生成 32 张贴纸底图（用你自带的生图工具）

**Files:** Create `docs/stickers/img/*.png`（32 张）、`docs/stickers/img/hero.png`

- [ ] **Step 1: 读方法**

读 `~/Developer/项目试验/logo-to-stickers/SKILL.md`、`references/design-method.md`、`references/prompt-template.md`，再看 `docs/assets/` 里几张成品。照这个方法做：每张图一个小情节——**谁做了什么 → 一点小意外 → 看得出来的反应**；纸贴纸质感、细白色模切边。

- [ ] **Step 2: 先定 6 个原创角色**

| 角色 id | 形象 |
|---|---|
| burger | 圆滚滚的双层汉堡，芝麻面包顶像一顶软帽子 |
| fries | 纸盒装的薯条，薯条像一头竖起来的头发 |
| nuggets | 一块圆乎乎的炸鸡块，边缘有点不规整，很机灵 |
| coffee | 纸杯咖啡，杯盖像一顶贝雷帽，冒着一缕热气 |
| cone | 甜筒，冰淇淋顶是一撮卷起来的发旋 |
| cola | 带吸管的纸杯饮料，吸管像一根天线 |

包装一律素色（暖红、奶油白、浅棕之间选），**不画任何 logo、字母 M、品牌字样**。先生成汉堡的「收到」那一张，自己检查满意后，用它当后面所有图的身份参考（脸、比例、线条、纸张质感保持一致）。

- [ ] **Step 3: 24 张反应贴（每个角色 4 张，文件名 `<角色>-<反应>.png`）**

| 反应 | 情节（按角色换成它自己的帽子、薯条、热气、发旋、吸管） |
|---|---|
| ok（收到） | 角色认真敬礼，结果「帽子」滑下来半边，表情还是很认真 |
| go（冲） | 角色助跑起跳，身后掉了一点小东西（一颗芝麻 / 一根薯条 / 一滴饮料），眼神坚定 |
| hungry（饿了） | 角色趴在桌边，用一根小叉子轻轻敲一只空碟子，眼睛望向画外 |
| night（晚安） | 角色盖着一张餐巾纸当被子睡着了，「帽子」挂在旁边一盏小台灯上 |

- [ ] **Step 4: 8 张习惯贴（文件名见 library.json 的 `image`）**

| 文件 | 情节 |
|---|---|
| trait-early-bird.png | 一个早餐松饼角色背着书包小跑，手里攥着一杯热饮，天边刚亮，书包带跑歪了 |
| trait-night-owl.png | 鸡块角色打着小手电在月亮下巡逻，月亮画得像一块薯饼 |
| trait-fries-loyalist.png | 薯条角色紧紧抱住自己的纸盒，警惕地盯着画面边缘伸进来的一只手 |
| trait-spicy.png | 鸡腿汉堡角色脸颊冒出两朵小火苗，一边给自己扇风一边很满足 |
| trait-group-host.png | 汉堡角色举着一张长长的清单，清单一直拖到地上，后面跟着三个小伙伴 |
| trait-weekend.png | 可乐角色戴着墨镜躺在野餐垫上，吸管撑开变成一把小遮阳伞 |
| trait-coffee-lover.png | 咖啡角色闭着眼往前走，冒出的热气画成一个正在充电的小电池 |
| trait-sweet-tooth.png | 甜筒角色踮着脚去够桌沿上的一块苹果派，冰淇淋顶歪向一边 |

- [ ] **Step 5: 每张图的硬性要求**

- 真透明背景 PNG；角色外沿有一圈细白色模切边（缩到 240px 时至少 2px），带轻微纸张质感。
- **图里不要有任何文字**（配字由网页叠加）。
- 角色四周留足边距，不贴画布边缘；构图紧凑，缩到 160–240px 还看得清。
- 不画 logo、金拱门、麦当劳叔叔、品牌字样；不画「吃很多」「撑」「胖」相关的画面。

- [ ] **Step 6: 缩尺寸并检查**

```bash
cd docs/stickers/img
for f in *.png; do sips -Z 512 "$f" >/dev/null; done
ls -1 *.png | wc -l
python3 - <<'EOF'
import json, os
lib = json.load(open("../library.json"))
need = [f"{c['id']}-{r['id']}.png" for c in lib["characters"] for r in lib["reactions"]] + [t["image"] for t in lib["traits"]]
missing = [n for n in need if not os.path.exists(n)]
print("missing:", missing)
print("max KB:", max(os.path.getsize(n) for n in need if os.path.exists(n)) // 1024)
EOF
```

Expected: `missing: []`，单张最好在 200KB 以内。再把 32 张拼成一张总览图自己逐张看一遍：同一角色是不是同一个形象，有没有字，有没有贴边。

- [ ] **Step 7: hero 图**

用已生成的贴纸做参考，再生成一张 `hero.png`：6 个角色像一张没撕开的贴纸页那样错落排在纸面上，横版 1600×1000，透明或纸色背景，同样不能有字和 logo。

**时间不够时的优先级**：先做全 8 张习惯贴 + 汉堡和薯条的 8 张反应贴，网页先跑起来；其余 16 张反应贴随后补齐。

- [ ] **Step 8: Commit**

```bash
git add docs/stickers/img
git commit -m "feat: add paper sticker artwork"
```

---

### Task 5: 网页（GitHub Pages）

**Files:** Create `docs/index.html`、`docs/styles.css`、`docs/app/render.js`、`docs/app/main.js`

**设计方向**：沿用 logo-to-stickers 画廊（`~/Developer/项目试验/logo-to-stickers/docs/`）的编辑部风格：纸色底、近黑字、一条细分隔线、大号紧排标题、衬线斜体点缀，一页只有一个强调色。这次换成暖纸和番茄酱红：

```css
:root {
  color-scheme: light;
  --paper: #f3efe6;
  --ink: #232724;
  --muted: #6e6a62;
  --line: #d9d2c4;
  --accent: #c8402b;
  --serif: Georgia, "Songti SC", "Noto Serif SC", serif;
  --sans: -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif;
}
```

用户的设计红线（以前多次被骂过，必须遵守）：
- 一个主角少装饰：首屏的主角就是那张贴纸页 hero，别的元素都让路。
- 只有一个强调色；不要霓虹、马卡龙色块、渐变头像、满屏胶囊标签、bento 拼贴。
- 毛玻璃最多只在很小的面积用一次；不要浮在内容上的说明卡。
- 贴纸本身负责「好玩」：轻微旋转、白边、柔和投影，hover / 按下时像揭起一角（transform + shadow，克制）。
- 手机端是主场（朋友会从微信里点开）：390px 宽度逐段检查，左右 16px 边距，不许横向滚动。

**页面结构**：

1. 顶栏：字标「麦门贴贴」+ GitHub 链接。
2. 首屏：小字眉标「麦当劳 MCP · 参赛作品」；大标题「把你吃麦当劳的样子，做成一套表情包。」；一句说明；两个按钮「先玩一下」（跳 `#play`）和「用我的订单生成」（跳 `#install`）；hero 贴纸页。
3. `#play` 问答：一屏一题，5 题。①你的本命是？（6 个角色，用贴纸图当选项）②一般什么时候去？（早八前 / 中午 / 晚上九点后 / 看心情）③薯条？（每次都要 / 看心情）④吃辣吗？（要辣的 / 不吃辣）⑤还有哪些像你？（多选：常给大家组局、周末才去、离不开咖啡、要来点甜的）。答案组装成 `quizToPersona` 需要的对象。
4. 结果区：可选昵称输入（最多 12 字）；贴纸网格，每张显示合成后的 240×240 图，点配字可以改（改完过 `validatePack`，不合规就就地提示原因）；按钮「下载全部」（ZIP）和「复制链接」。在微信内置浏览器里（UA 含 `MicroMessenger`）隐藏下载按钮，改成提示「长按图片保存，再在聊天里添加到表情」，因为微信里不能下载文件。
5. `#install`：三步。`npx skills add huyanxius/maimen-tietie`；按麦当劳官方指南配置 `mcd-mcp`；对 AI 说「用麦门贴贴读我的麦当劳订单，做一套表情包」。
6. 页脚：「非麦当劳官方产品，角色均为原创，不含麦当劳商标」；参赛说明；GitHub。

**链接模式**：页面加载时如果 `location.hash` 以 `#p=` 开头，就 `decodePack` → `validatePack`，直接显示那套贴纸，跳过问答；解不开就提示链接坏了，并给「先玩一下」入口。

- [ ] **Step 1: 写 `docs/app/render.js`（合成和打包，下面是要用的实现）**

```js
// 把贴纸底图和配字合成为一张透明 PNG，再打包下载。
// 输出 240×240：微信表情主图的尺寸。底图放在上面约四分之三的区域，配字压在底部，白描边保证在任何聊天背景上都读得清。

export const STICKER_SIZE = 240;
const CAPTION_FONT = '"ZCOOL KuaiLe", "PingFang SC", sans-serif';
const INK = "#232724";

export function isWeChat() {
  return /MicroMessenger/i.test(navigator.userAgent);
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
  const pad = Math.round(size * 0.04);
  const boxH = Math.round(size * 0.76);
  const scale = Math.min((size - pad * 2) / img.width, (boxH - pad) / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, pad + (boxH - pad - h) / 2, w, h);

  // 字体没加载完就画会退回系统字体，所以先等这几个字用到的字形加载好
  let fontSize = Math.round(size * 0.16);
  await document.fonts.load(`${fontSize}px ${CAPTION_FONT}`, caption);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (;;) {
    ctx.font = `${fontSize}px ${CAPTION_FONT}`;
    if (ctx.measureText(caption).width <= size - pad * 2 || fontSize <= 12) break;
    fontSize -= 2;
  }
  const y = size - pad - Math.round(size * 0.02);
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, Math.round(fontSize * 0.28));
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(caption, size / 2, y);
  ctx.fillStyle = INK;
  ctx.fillText(caption, size / 2, y);
  return canvas;
}

// files: [{ name: "01-收到.png", canvas }]；JSZip 由 index.html 从 cdn.jsdelivr.net 引入，挂在 window 上
export async function downloadZip(files, zipName) {
  const zip = new window.JSZip();
  for (const f of files) zip.file(f.name, f.canvas.toDataURL("image/png").split(",")[1], { base64: true });
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
```

- [ ] **Step 2: 写 `index.html`、`styles.css`、`main.js`**

`index.html` 里引入：

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap">
<link rel="stylesheet" href="styles.css">
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" defer></script>
<script type="module" src="app/main.js"></script>
```

`main.js` 用 `fetch("stickers/library.json")` 读定义，问答和链接模式都走 `core.js`，画图都走 `render.js`。图片文件名一律用 `imageOf()` 算，前面拼 `stickers/img/`。

- [ ] **Step 3: 本地起服务，在浏览器里看**

```bash
python3 -m http.server 8000 -d docs
```

逐项检查，截图留证：
- 390×844 和 1280×800 两个宽度，从上到下逐段看，没有横向滚动，没有文字溢出。
- 问答走完一遍，结果的张数和 `quizToPersona` 一致。
- 用 Task 2 里 `link` 命令输出的链接，把域名换成 `http://localhost:8000/`，打开后显示的贴纸和脚本输出的 `pack.stickers` 一张不差。
- 「下载全部」得到的 ZIP 里每张都是 240×240 透明 PNG，配字完整不被裁。
- 配字改成 9 个字或「吃到吐」会被拦下并提示原因。
- 用户的设计红线逐条过一遍。

- [ ] **Step 4: Commit**

```bash
git add docs/index.html docs/styles.css docs/app/render.js docs/app/main.js
git commit -m "feat: add sticker maker web page"
```

---

### Task 6: `SKILL.md`

**Files:** Create `SKILL.md`

- [ ] **Step 1: 写 `SKILL.md`**

````markdown
---
name: maimen-tietie
description: 麦门贴贴。读用户的麦当劳订单（麦当劳 MCP），找出本命餐和吃麦当劳的习惯，生成一套能加进微信的纸贴纸表情包。用户说“做一套麦当劳表情包”“麦门贴贴”“看看我的麦门人设”时使用。
---

# 麦门贴贴

把一个人吃麦当劳的样子，变成一套能在群里发的表情包。

需要已接入麦当劳 MCP（服务名 `mcd-mcp`，地址 `https://mcp.mcd.cn`）。没接入时，告诉用户按 README 配置，或者先去网页问答模式玩：https://huyanxius.github.io/maimen-tietie/#play 。不要编造订单。

## 流程

1. 调 `now-time-info` 确认当前时间。
2. 调 `order-list` 取最近的订单，目标 10–30 单。订单里没有餐品名时，用 `query-order` 补，整次最多补 20 单。
3. 只保留每单的下单时间（北京时间，`YYYY-MM-DD HH:MM`）和餐品名、份数，写进 `/tmp/maimen-orders.json`：

   ```json
   {"orders": [{"time": "2026-10-05 07:40", "items": [{"name": "猪柳麦满分", "qty": 1}]}]}
   ```

   地址、电话、价格、订单号一律不写。

4. 运行：

   ```bash
   python3 scripts/tietie.py link /tmp/maimen-orders.json --name 用户想要的昵称
   ```

   昵称可以不给。退出码为 1 且提示订单太少时，把网页问答模式的链接给用户。

5. 用自然的话告诉用户：本命角色是谁；命中了哪些习惯，每个习惯带上脚本给的证据（比如「5 单里 3 单在早上 9:30 前」）；然后给出 `link`。说明用法：电脑上点「下载全部」，手机上长按单张保存，再在微信聊天里「添加到表情」。
6. 用户想改配字：把输出里的 `pack` 存成文件，改 `caption`（1–8 个字），运行 `python3 scripts/tietie.py encode 文件路径` 拿新链接。也可以让用户直接在网页上点配字修改。
7. 生成完成后删掉 `/tmp/maimen-orders.json`。

## 可选：再来一单本命餐

只有用户主动提出时才做：用 `query-nearby-stores`（或外送流程的 `delivery-query-addresses`、`delivery-query-stores`）定门店 → `query-meals` 找到本命餐 → `calculate-price` 算价并展示 → 用户明确说确认 → `create-order`，把支付链接交给用户本人支付。

## 约定

- 默认只读。`create-order`、`cancel-order`、`auto-bind-coupons`、`draw-lottery`、`mall-create-order` 没有用户当场明确同意一律不调。
- 人设只谈时间和口味，不评论体重、身材，不拿「吃了多少」开玩笑。
- 链接里只有角色、贴纸编号、配字和昵称，不含订单数据；不要把订单写进其他文件。
- 不在对话里回显 MCP Token。
````

- [ ] **Step 2: 检查 frontmatter**

Run: `python3 -c "import re;s=open('SKILL.md',encoding='utf-8').read();print(re.match(r'---\n(.*?)\n---\n',s,re.S).group(1))"`
Expected: 打印出 `name: maimen-tietie` 和 `description: ...`

- [ ] **Step 3: Commit**

```bash
git add SKILL.md
git commit -m "feat: add maimen-tietie skill workflow"
```

---

### Task 7: `README.md` 和 `MCP_INTEGRATION.md`

**Files:** Create `README.md`、`MCP_INTEGRATION.md`

- [ ] **Step 1: 写 `README.md`**

````markdown
# 麦门贴贴 maimen-tietie

把你吃麦当劳的样子，做成一套能发的表情包。

![麦门贴贴](docs/stickers/img/hero.png)

**[在线玩一下 →](https://huyanxius.github.io/maimen-tietie/)** 不用登录，答 5 道题，当场拿到一套贴纸。

麦门贴贴是一个基于[麦当劳 MCP](https://open.mcd.cn/mcp) 的 Skill。它读你最近的麦当劳订单，看出你的本命餐，以及你什么时候去、怎么点：总在早八前买麦满分，深夜才点鸡块，薯条每单都有……再把这些习惯画成一套纸贴纸，配上字，导出成可以直接加进微信的表情包。

## 目标用户

- 每周都会去一两次麦当劳、在群里说话离不开表情包的人
- 想给宿舍、朋友整一套“自己人”表情的人

## 一套贴纸里有什么

- 4 张反应贴：你的本命角色说「收到」「冲」「饿了」「晚安」，日常聊天就能用。
- 最多 4 张习惯贴：从订单里读出来的你，比如「早八续命中」「夜里也营业」「薯条必须有」。

每张都是 240×240 的透明 PNG，符合微信表情尺寸。配字可以自己改。

## 安装方法

1. 用手机号登录 [open.mcd.cn/mcp](https://open.mcd.cn/mcp)，在控制台点「激活」申请 MCP Token。
2. 把麦当劳 MCP 接进你的 Agent，再装上这个 Skill：

   **Claude Code**

   ```bash
   claude mcp add --transport http mcd-mcp https://mcp.mcd.cn --header "Authorization: Bearer 你的Token"
   npx skills add huyanxius/maimen-tietie
   ```

   **WorkBuddy**：按[麦当劳官方指南](https://github.com/M-China/mcd-developer-innovation-challenge)在【专家·技能·连接器】里配置 `mcd-mcp` 连接器，再导入本仓库作为技能。

   **其他支持 MCP 和 Skill 的客户端**：

   ```json
   {
     "mcpServers": {
       "mcd-mcp": {
         "type": "streamablehttp",
         "url": "https://mcp.mcd.cn",
         "headers": {"Authorization": "Bearer 你的Token"}
       }
     }
   }
   ```

3. 本机需要 Python 3.9 或更高版本，脚本只用标准库。

## 使用示例

对你的 Agent 说：

> 用麦门贴贴读我的麦当劳订单，做一套表情包。

它会告诉你本命角色、命中的习惯和依据，再给你一个链接。打开链接，电脑上点「下载全部」，手机上长按单张保存，然后在微信聊天里「添加到表情」。

## 隐私

- 订单只在你本机的 Agent 里读，分析完就删。
- 分享链接里只有角色、贴纸编号、配字和昵称，没有任何订单数据。
- 默认只读，不会替你下单、领券或抽奖；只有你主动要求「再来一单」，并且当场确认，才会下单。

## 合规

角色全部原创，画面里没有麦当劳商标；配字只聊时间和口味，不拿吃了多少、身材开玩笑。本项目为参赛作品，非麦当劳官方产品。

## 开发

```bash
python3 -m unittest discover -s tests -v
node --test docs/app/core.test.mjs
python3 -m http.server 8000 -d docs
```

## 参赛说明

本项目参加「麦当劳程序员创意开发大赛」，参赛声明见 [CONTEST_DECLARATION.md](./CONTEST_DECLARATION.md)，MCP 使用说明见 [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)。

同系列：[logo-to-stickers](https://github.com/huyanxius/logo-to-stickers)，把 logo 变成会干活的纸贴纸。

喜欢这套贴纸的话，点个 Star 吧。
````

- [ ] **Step 2: 写 `MCP_INTEGRATION.md`**

```markdown
# 麦当劳 MCP 使用说明

## MCP Server

- 名称：麦当劳中国 MCP Server（`mcd-mcp`）
- 地址：`https://mcp.mcd.cn`
- 协议：Streamable HTTP，请求头 `Authorization: Bearer <MCP Token>`
- Token：用户本人在 open.mcd.cn 申请，本项目不保存、不回显

## 用到的 Tool

| 阶段 | Tool | 用途 |
|---|---|---|
| 准备 | `now-time-info` | 确认当前时间，界定「最近」的订单范围 |
| 读订单 | `order-list` | 取最近的到店 / 外送历史订单 |
| 读订单 | `query-order` | 订单缺餐品明细时补全 |
| 可选：再来一单 | `query-nearby-stores` / `delivery-query-addresses` / `delivery-query-stores` | 定门店 |
| 可选：再来一单 | `query-meals` | 在当前门店找到本命餐 |
| 可选：再来一单 | `calculate-price` | 算价给用户确认 |
| 可选：再来一单 | `create-order` | 用户当场确认后下单，返回支付链接 |

## 调用流程

1. `now-time-info` → 2. `order-list`（必要时 `query-order`）→ 3. 本地脚本 `scripts/tietie.py` 把订单变成人设和贴纸包 → 4. 生成网页链接，网页把贴纸底图和配字合成为 240×240 PNG。可选：用户要求时，`query-meals` → `calculate-price` → 确认 → `create-order`。

## 业务价值

- 对用户：自己的吃饭习惯变成一套专属表情包，好玩、能用、愿意分享。
- 对麦当劳：表情包会在群聊里被反复发送，相当于用户自发的、长期的品牌内容；「再来一单本命餐」把好感直接接回点餐。
- 数据只读、链接不含订单，用户可以放心授权。
```

- [ ] **Step 3: Commit**

```bash
git add README.md MCP_INTEGRATION.md
git commit -m "docs: add readme and mcp integration notes"
```

---

### Task 8: 用真实 Token 跑通（需要用户先给 Token）

没有 `MCD_MCP_TOKEN` 就先跳过本任务，直接做 Task 9；Token 到了再回来补，那时仓库已公开，补的改动走分支 + PR。

- [ ] **Step 1:** 在你（Codex）自己的 MCP 配置里接入 `mcd-mcp`（Streamable HTTP，`https://mcp.mcd.cn`，请求头 `Authorization: Bearer $MCD_MCP_TOKEN`），确认能列出工具。Token 只在本机配置里。
- [ ] **Step 2:** 按 `SKILL.md` 走一遍：调 `order-list`，记录返回里下单时间、餐品名、份数分别是哪个字段、时间是什么格式，把对应关系写进 `SKILL.md` 第 2–3 步（替换成具体字段名）。
- [ ] **Step 3:** 用真实订单跑 `python3 scripts/tietie.py link /tmp/maimen-orders.json`，在本地网页打开链接，确认贴纸正确。用户订单不足 3 单时，换成问答模式验证。
- [ ] **Step 4:** 截一张网页结果区的图存为 `docs/stickers/img/result-preview.png`（不含任何个人信息），在 README「一套贴纸里有什么」下面引用。
- [ ] **Step 5: Commit**

```bash
git add SKILL.md README.md docs/stickers/img/result-preview.png
git commit -m "docs: map order-list fields from live run"
```

---

### Task 9: 公开、开网页、报名（用户已授权，满足底线就直接做）

- [ ] **Step 1: 留证后直接继续：** 把手机和桌面各一张网页截图存进 `plans/publish-check/`，`git log --oneline` 存成 `plans/publish-check/log.txt`，供用户醒来后看。不用等回复。

Issue 标题：

```
【参赛申请】麦门贴贴：把你吃麦当劳的样子做成一套表情包
```

Issue 正文（标签和内容同一行，冒号后不换行；项目地址不要写成 Markdown 链接）：

```
【参赛申请】
项目名称：麦门贴贴 maimen-tietie
项目地址：https://github.com/huyanxius/maimen-tietie
项目简介：读你的麦当劳订单，看出本命餐和吃麦当劳的习惯，生成一套原创纸贴纸表情包，240×240 透明 PNG，能直接加进微信；没有账号也能在网页上答 5 道题玩出一套。
```

- [ ] **Step 2: 公开仓库并开 GitHub Pages**

```bash
gh repo create huyanxius/maimen-tietie --public --source . --push --description "麦门贴贴：读你的麦当劳订单，生成一套能加进微信的原创纸贴纸表情包（麦当劳 MCP Skill）· 在线玩 https://huyanxius.github.io/maimen-tietie/"
gh repo edit huyanxius/maimen-tietie --homepage https://huyanxius.github.io/maimen-tietie/ --add-topic mcp --add-topic mcdonalds --add-topic stickers --add-topic skill --add-topic agent-skills --add-topic wechat
gh api -X POST repos/huyanxius/maimen-tietie/pages -f "source[branch]=main" -f "source[path]=/docs"
```

等一两分钟后确认网页上线：

```bash
gh api repos/huyanxius/maimen-tietie/pages/builds/latest --jq .status
curl -s -o /dev/null -w "%{http_code}\n" https://huyanxius.github.io/maimen-tietie/
```

Expected: `built` 和 `200`。再用手机宽度打开线上地址看一遍。

- [ ] **Step 3: 发报名 Issue**

```bash
gh issue create -R M-China/mcd-developer-innovation-challenge \
  --title "【参赛申请】麦门贴贴：把你吃麦当劳的样子做成一套表情包" \
  --body "$(printf '【参赛申请】\n项目名称：麦门贴贴 maimen-tietie\n项目地址：https://github.com/huyanxius/maimen-tietie\n项目简介：读你的麦当劳订单，看出本命餐和吃麦当劳的习惯，生成一套原创纸贴纸表情包，240×240 透明 PNG，能直接加进微信；没有账号也能在网页上答 5 道题玩出一套。')"
```

- [ ] **Step 4: 确认报名成功**

```bash
gh issue list -R M-China/mcd-developer-innovation-challenge --author huyanxius
gh issue view <上一步的编号> -R M-China/mcd-developer-innovation-challenge --comments
```

Expected: 机器人回复报名成功；失败就按原因改，改完重新发。

- [ ] **Step 5: 补工作日志**

在 `/Users/huyan/Documents/Obsidian Vault/99-记忆/工作日志.md` 分隔线下方、现有第一条之上补一行：
`- YYYY-MM-DD HH:MM [CX] 麦门贴贴 — 公开仓库、开 Pages 并报名 · github.com/huyanxius/maimen-tietie`

---

## 收尾（不管做到哪一步都要做）

在 `plans/STATUS.md` 写清楚：做完了哪些任务；卡在哪、为什么；用户醒来要做的事（申请麦当劳 MCP Token、看一眼线上网页、叫朋友点星）。然后按 Task 9 Step 5 的格式补一行工作日志。
