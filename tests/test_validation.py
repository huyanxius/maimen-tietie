"""跨运行时的输入边界；全部数据是合成样例，不使用账户或真实订单。"""
import base64
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import tietie  # noqa: E402

LIB = tietie.load_library()
PACK = {"v": 1, "name": "小王", "character": "fries", "stickers": [{"id": "r:fries:ok", "caption": "收到"}]}


def raw_token(value):
    raw = value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def order(time="2026-10-05 12:00", items=None):
    return {"time": time, "items": [{"name": "纸巾", "qty": 1}] if items is None else items}


def persona_with(times, name="纸巾"):
    return tietie.build_persona([order(time, [{"name": name, "qty": 1}]) for time in times], LIB)


class PackValidationTest(unittest.TestCase):
    def assert_invalid(self, pack):
        for validate in (lambda: tietie.validate_pack(pack, LIB), lambda: tietie.encode_pack(pack), lambda: tietie.decode_pack(raw_token(pack))):
            with self.assertRaises(ValueError):
                validate()

    def test_pack_must_be_object_with_exact_fields(self):
        for value in (None, [], "pack", 1, True):
            with self.subTest(value=value):
                self.assert_invalid(value)
        for field in PACK:
            pack = copy.deepcopy(PACK)
            del pack[field]
            with self.subTest(missing=field):
                self.assert_invalid(pack)

    def test_unknown_fields_never_reach_encode_or_link(self):
        for field in ("orders", "address", "token", "items", "time"):
            pack = dict(PACK, **{field: "synthetic-private-field"})
            with self.subTest(field=field):
                self.assert_invalid(pack)
                with self.assertRaises(ValueError):
                    tietie.pack_link(pack, LIB)
        pack = copy.deepcopy(PACK)
        pack["stickers"][0]["address"] = "synthetic-private-field"
        self.assert_invalid(pack)

    def test_version_rejects_boolean_and_non_one(self):
        for version in (True, False, "1", None, 0, 2):
            with self.subTest(version=version):
                self.assert_invalid(dict(PACK, v=version))
        self.assertEqual(tietie.encode_pack(dict(PACK, v=1.0)), tietie.encode_pack(PACK))

    def test_pack_field_types(self):
        for field, values in (("name", (None, 1, [], {})), ("character", (None, 1, [], "", "fries\n")), ("stickers", (None, "", {}, 1))):
            for value in values:
                with self.subTest(field=field, value=value):
                    self.assert_invalid(dict(PACK, **{field: value}))

    def test_sticker_shapes_and_types(self):
        for sticker in (None, [], {}, {"id": "r:fries:ok"}, {"caption": "收到"}, {"id": None, "caption": "收到"}, {"id": "r:fries:ok", "caption": None}, {"id": "r:fries:ok", "caption": ["收"]}):
            with self.subTest(sticker=sticker):
                self.assert_invalid(dict(PACK, stickers=[sticker]))

    def test_known_character_and_sticker_membership(self):
        for pack in (dict(PACK, character="pizza"), dict(PACK, stickers=[{"id": "t:unknown", "caption": "收到"}])):
            with self.subTest(pack=pack):
                with self.assertRaises(ValueError):
                    tietie.validate_pack(pack, LIB)
                with self.assertRaises(ValueError):
                    tietie.encode_pack(pack, LIB)
                with self.assertRaises(ValueError):
                    tietie.decode_pack(raw_token(pack), LIB)

    def test_sticker_id_grammar_is_exact(self):
        for sid in ("r:fries:ok:extra", "t:spicy:extra", "t:spicy\n", "r:fries:ok\n", "r:fries", "r::ok", "r:fries:../ok", "t:../spicy", "t:SPICY", " t:spicy"):
            with self.subTest(sid=sid):
                self.assert_invalid(dict(PACK, stickers=[{"id": sid, "caption": "收到"}]))
                with self.assertRaises(ValueError):
                    tietie.image_of(sid, LIB)

    def test_duplicate_stickers_rejected(self):
        self.assert_invalid(dict(PACK, stickers=PACK["stickers"] * 2))

    def test_custom_pack_count_boundaries(self):
        stickers = [{"id": f"r:{char['id']}:{reaction['id']}", "caption": "好"} for char in LIB["characters"] for reaction in LIB["reactions"]]
        for count in (1, 16):
            self.assertIsNotNone(tietie.validate_pack(dict(PACK, stickers=stickers[:count]), LIB))
        for count in (0, 17):
            self.assert_invalid(dict(PACK, stickers=stickers[:count]))

    def test_caption_codepoint_limits(self):
        for caption in ("好", "😀" * 8, "一二三四五六七八"):
            pack = dict(PACK, stickers=[{"id": "r:fries:ok", "caption": caption}])
            self.assertEqual(tietie.decode_pack(tietie.encode_pack(pack)), pack)
        for caption in ("", "😀" * 9, "一二三四五六七八九"):
            self.assert_invalid(dict(PACK, stickers=[{"id": "r:fries:ok", "caption": caption}]))

    def test_each_banned_caption_is_rejected(self):
        for word in tietie.BANNED:
            with self.subTest(word=word):
                self.assert_invalid(dict(PACK, stickers=[{"id": "r:fries:ok", "caption": "别" + word}]))

    def test_name_codepoint_limits_and_builder_truncation(self):
        self.assertIsNotNone(tietie.validate_pack(dict(PACK, name="😀" * 12), LIB))
        self.assert_invalid(dict(PACK, name="😀" * 13))
        built = tietie.build_pack({"character": "fries", "traits": []}, LIB, "😀" * 13)
        self.assertEqual(built["name"], "😀" * 12)

    def test_lone_surrogates_are_not_silently_replaced(self):
        for text in ("\ud800", "\udfff"):
            for field in ("name", "caption"):
                pack = copy.deepcopy(PACK)
                if field == "name":
                    pack[field] = text
                else:
                    pack["stickers"][0][field] = text
                for validate in (lambda: tietie.validate_pack(pack, LIB), lambda: tietie.encode_pack(pack)):
                    with self.subTest(field=field, text=repr(text)):
                        with self.assertRaises(ValueError):
                            validate()
                with self.assertRaises(ValueError):
                    tietie.decode_pack(raw_token(json.dumps(pack, ensure_ascii=True).encode("utf-8")))

    def test_encoding_is_canonical_for_reordered_objects(self):
        reordered = {"stickers": [{"caption": "收到", "id": "r:fries:ok"}], "character": "fries", "name": "小王", "v": 1}
        self.assertEqual(tietie.encode_pack(reordered), tietie.encode_pack(PACK))
        self.assertEqual(list(reordered), ["stickers", "character", "name", "v"])

    def test_unicode_and_escaping_match_javascript(self):
        # 码点计数不是字节数/UTF-16 单元数；控制字符和 U+2028 的 JSON 转义也必须一致。
        pack = dict(PACK, name="😀小王\"\\", stickers=[{"id": "r:fries:ok", "caption": '好"\\😀'}])
        js = "import { encodePack } from './docs/app/core.js'; let x=''; for await (const c of process.stdin) x+=c; console.log(encodePack(JSON.parse(x)));"
        result = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ROOT, input=json.dumps(pack, ensure_ascii=False), text=True, capture_output=True, check=True)
        self.assertEqual(result.stdout.strip(), tietie.encode_pack(pack))

    def test_builder_rejects_invalid_persona_and_name(self):
        for persona in (None, {}, {"character": "pizza", "traits": []}, {"character": "fries", "traits": [None]}, {"character": "fries", "traits": [{"id": []}]}, {"character": "fries", "traits": [{"id": "weekend"}] * 5}):
            with self.subTest(persona=persona):
                with self.assertRaises(ValueError):
                    tietie.build_pack(persona, LIB)
        with self.assertRaises(ValueError):
            tietie.build_pack({"character": "fries", "traits": []}, LIB, 1)


class TokenValidationTest(unittest.TestCase):
    def test_bad_token_formats(self):
        token = tietie.encode_pack(PACK)
        for value in (None, 1, [], "", "a", "abc=", "+abc", "/abc", " abc", token + "\n", "é", "%7B", "a" * (tietie.MAX_TOKEN + 1)):
            with self.subTest(value=str(value)[:20]):
                with self.assertRaises(ValueError):
                    tietie.decode_pack(value)

    def test_invalid_utf8_and_non_json(self):
        for raw in (b"\xff", b'\xc0\xaf', b'\xed\xa0\x80', b'\xef\xbb\xbf{}', b"not json", b'{"v":NaN}', b"[" * 1500 + b"]" * 1500):
            with self.subTest(raw=raw[:20]):
                with self.assertRaises(ValueError):
                    tietie.decode_pack(raw_token(raw))

    def test_invalid_utf8_inside_json_is_rejected(self):
        raw = b'{"v":1,"name":"' + b'\xff' + b'","character":"fries","stickers":[{"id":"r:fries:ok","caption":"ok"}]}'
        with self.assertRaises(ValueError):
            tietie.decode_pack(raw_token(raw))

    def test_json_values_are_not_arbitrary_packs(self):
        for value in (None, [], "text", 1, {"orders": []}):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    tietie.decode_pack(raw_token(value))

    def test_noncanonical_base64_unused_bits_rejected(self):
        token = tietie.encode_pack(PACK)
        # 追加 JSON 空白，使最后一个 base64 字符确实有未用的位。
        raw = json.dumps(PACK).encode("utf-8")
        while len(raw) % 3 == 0:
            raw += b" "
        token = raw_token(raw)
        alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        changed = token[:-1] + alphabet[alphabet.index(token[-1]) + 1]
        with self.assertRaises(ValueError):
            tietie.decode_pack(changed)
        self.assertEqual(tietie.decode_pack(token), PACK)


class OrderValidationTest(unittest.TestCase):
    def test_bad_order_shapes(self):
        for orders in (None, {}, "orders", [None] * 3, [{}] * 3, [order(items=[])] * 3, [dict(order(), items="items")] * 3, [order(items=[None])] * 3, [order(items=[{}])] * 3):
            with self.subTest(orders=orders):
                with self.assertRaises(ValueError):
                    tietie.build_persona(orders, LIB)

    def test_time_is_valid_beijing_naive_minute_precision(self):
        for time in (None, 1, "2026-02-30 12:00", "2026-10-05 24:00", "2026-10-05T12:00", "2026-10-05 12:00:00", "2026-10-05 12:00+08:00", "2026-1-5 12:00", "2026-10-05 12:00\n"):
            with self.subTest(time=time):
                with self.assertRaises(ValueError):
                    tietie.build_persona([order(time)] * 3, LIB)
        self.assertEqual(tietie.build_persona([order("2024-02-29 12:00")] * 3, LIB)["order_count"], 3)

    def test_quantity_is_positive_integer_not_boolean(self):
        for qty in (0, -1, True, False, 1.5, "1", None):
            with self.subTest(qty=qty):
                with self.assertRaises(ValueError):
                    tietie.build_persona([order(items=[{"name": "汉堡", "qty": qty}])] * 3, LIB)
        p = tietie.build_persona([order(items=[{"name": "咖啡"}, {"name": "薯条", "qty": 2}])] * 3, LIB)
        self.assertEqual(p["character_counts"], {"coffee": 3, "fries": 6})

    def test_item_name_is_nonempty_text(self):
        for name in (None, [], 1, "", "  ", "\ud800"):
            with self.subTest(name=repr(name)):
                with self.assertRaises(ValueError):
                    tietie.build_persona([order(items=[{"name": name, "qty": 1}])] * 3, LIB)

    def test_character_tie_library_order_and_unknown_fallback(self):
        p = tietie.build_persona([order(items=[{"name": "薯条", "qty": 1}, {"name": "汉堡", "qty": 1}])] * 3, LIB)
        self.assertEqual(p["character"], "burger")
        self.assertEqual(tietie.build_persona([order()] * 3, LIB)["character"], "burger")

    def test_breakfast_time_boundaries(self):
        times = ["2026-10-05 " + t for t in ("04:59", "05:00", "09:29", "09:30", "20:59", "21:00")]
        traits = persona_with(times)["traits"]
        self.assertEqual([t["id"] for t in traits], ["early_bird", "night_owl"])
        self.assertTrue(all(t["evidence"].startswith("2/6") for t in traits))

    def test_at_least_two_hits_even_if_fraction_passes(self):
        times = ["2026-10-05 07:00", "2026-10-06 12:00", "2026-10-07 12:00"]
        self.assertEqual(persona_with(times)["traits"], [])

    def test_trait_thresholds_are_inclusive(self):
        # 分别卡住 30%、40%、50%、60%，只把门槛对应的规则单独命中。
        cases = [("early_bird", 3, "07:00", "纸巾"), ("spicy", 4, "12:00", "辣酱"), ("weekend", 5, "12:00", "纸巾"), ("fries_loyalist", 6, "12:00", "薯条")]
        for trait, hits, clock, name in cases:
            with self.subTest(trait=trait):
                rows = []
                for i in range(10):
                    date = "2026-10-10" if trait == "weekend" and i < hits else "2026-10-05"
                    rows.append(order(f"{date} {clock if i < hits else '12:00'}", [{"name": name if i < hits else "纸巾", "qty": 1}]))
                self.assertIn(trait, [t["id"] for t in tietie.build_persona(rows, LIB)["traits"]])
                # 少一单命中即不能过门槛。
                rows[hits - 1] = order()
                self.assertNotIn(trait, [t["id"] for t in tietie.build_persona(rows, LIB)["traits"]])

    def test_group_quantity_boundary_and_trait_tie_order(self):
        for qty, expected in ((3, False), (4, True)):
            rows = [order(items=[{"name": "纸巾", "qty": qty}])] * 3
            self.assertEqual("group_host" in [t["id"] for t in tietie.build_persona(rows, LIB)["traits"]], expected)
        rows = [order("2026-10-05 07:00", [{"name": n, "qty": 1} for n in ("辣汉堡", "薯条", "拿铁", "甜筒")])] * 3
        self.assertEqual([t["id"] for t in tietie.build_persona(rows, LIB)["traits"]], ["early_bird", "fries_loyalist", "spicy", "group_host"])


class MalformedCliTest(unittest.TestCase):
    def run_cli(self, command, path):
        return subprocess.run([sys.executable, str(ROOT / "scripts" / "tietie.py"), command, str(path)], capture_output=True, text=True)

    def assert_friendly_failure(self, result):
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("生成失败", result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        self.assertEqual(result.stdout, "")

    def test_malformed_arguments_exit_one(self):
        for args in ([], ["unknown"], ["link"], ["encode"], ["link", "input.json", "--unknown"]):
            with self.subTest(args=args):
                result = subprocess.run([sys.executable, str(ROOT / "scripts" / "tietie.py"), *args], capture_output=True, text=True)
                self.assert_friendly_failure(result)

    def test_missing_input_file(self):
        self.assert_friendly_failure(self.run_cli("link", ROOT / "tests" / "does-not-exist.json"))

    def test_malformed_file_content_and_shapes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "input.json"
            for raw in (b"\xff", b"{", b"[]", b"null", b'{"orders":null}', b'{"orders":[null,null,null]}'):
                with self.subTest(raw=raw):
                    path.write_bytes(raw)
                    self.assert_friendly_failure(self.run_cli("link", path))
            for pack in (None, [], dict(PACK, address="synthetic-private-field"), dict(PACK, stickers=None)):
                with self.subTest(pack=pack):
                    path.write_text(json.dumps(pack, ensure_ascii=False), encoding="utf-8")
                    self.assert_friendly_failure(self.run_cli("encode", path))


if __name__ == "__main__":
    unittest.main()
