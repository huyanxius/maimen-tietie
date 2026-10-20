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
