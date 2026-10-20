import unittest
from test_validation import PACK, LIB, tietie

class PrintableTextTest(unittest.TestCase):
    def test_captions_are_visible_and_single_line(self):
        for caption in (" ", "　", "好\n", "\t", "\x00", "好\x85", "好\u2028", "好\u2029"):
            with self.subTest(caption=repr(caption)), self.assertRaises(ValueError):
                tietie.validate_pack(dict(PACK, stickers=[{"id": "r:fries:ok", "caption": caption}]), LIB)
    def test_name_cannot_contain_controls(self):
        for name in ("小\n王", "\x7f", "\u2028"):
            with self.subTest(name=repr(name)), self.assertRaises(ValueError):
                tietie.validate_pack(dict(PACK, name=name), LIB)
