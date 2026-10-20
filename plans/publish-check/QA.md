# Final local release verification

Verified on 2026-10-20 UTC (2026-10-21 Beijing time). All browser input was performed in the dot cloud Chromium browser, not on the user's Mac.

## Release gate

- Python: 53 / 53 tests pass. Node: 32 / 32 tests pass (29 core, 3 renderer).
- Python 3.9 grammar check passes; execution used Python 3.12.14 and Node v24.19.0.
- 32 / 32 library-referenced artwork files exist: 24 reactions and 8 traits. Each is a 512×512 RGBA PNG with alpha extrema 0–255. The hero is 1600×1000.
- The original official CONTEST_DECLARATION.md is unchanged and matches the downloaded official reference SHA-256: cd28101bcb29cc8fb24b372fe91ce6b42c4a1487a54e01f7ade0c8c6a84241b7.
- Both source artwork manifests match all 33 final file hashes. The extra hero-thumbnail is not used by the page.

## Real browser coverage

The app was rendered in a same-origin iframe with explicit 390×844 and 1280×800 CSS-pixel dimensions. The entire iframe is scaled to 75% only in the private inspection wrapper so both viewports fit into a complete screenshot. The app's CSS layout viewport remains the stated size. This is browser responsive QA, not physical-device or WeChat-device testing.

Classic Chromium scrollbars reserve 15px: documentElement clientWidth and scrollWidth were both 375px in the 390px viewport and both 1265px in the 1280px viewport. Thus there was no horizontal document overflow.

At both widths, the hero, all five questions, generated result, install instructions and footer were actually inspected. All six role-selection images loaded. Eight generated cola stickers were visible in the correct two-column mobile / four-column desktop layouts. Long optional-answer English labels wrap inside their choices.

A small mobile-only heading adjustment keeps the headline on two intentional lines rather than leaving “包。” on an orphan third line. The final stylesheet was confirmed via a unique page query and its versioned stylesheet URL before final screenshots.

### Functional outcomes

- Mobile quiz: cola + night + fries + spicy + all four extras yields 8 stickers. Traits are night_owl, fries_loyalist, spicy and group_host, in library order and capped at four.
- Desktop quiz: fries + early + no fries habit + mild + zero extras yields 5 stickers.
- Previous / Next retains earlier answers; Restart clears the quiz.
- Nine-character and banned captions show inline errors and disable Download / Share.
- Thirteen-character nickname is rejected. Valid text restores the actions.
- Eight-character caption “今天也要好好休息” fits in the final 240px exported image with transparent edge space.
- Clipboard sharing returned a URL whose decoded pack has only v, name, character and stickers. Reloading that token in a fresh top-level page restored the same 8 stickers and nickname.
- A damaged token displays an explanation and a usable fresh quiz.
- The real top-level Download all action produced cola-eight-stickers.zip. All 8 entries are 240×240 RGBA PNGs, genuine alpha 0–255 and transparent edge margins. See cola-export-verification.json and cola-export-contact-sheet.png.
- Earlier real-browser fixture verification produced sample-stickers.zip (5 images); the local JSZip fallback was checked against the matching vendored CDN bytes. No fallback code changed afterward.
- The WeChat user-agent branch and font-failure fallback have unit coverage. A physical WeChat session was not used.

## Evidence

- mobile-390-hero.png, mobile-390-question-1.png through question-5.png
- mobile-390-result-top.png, mobile-390-result-bottom.png
- mobile-390-caption-too-long.png, mobile-390-caption-banned.png, mobile-390-invalid-link.png
- mobile-390-install.png, mobile-390-footer.png
- desktop-1280-hero.png, desktop-1280-question-1.png through question-5.png
- desktop-1280-result-top.png, desktop-1280-result-bottom.png
- desktop-1280-install-footer.png, desktop-1280-footer.png
- sticker-contact-sheet.png, asset-verification.json
- cola-export-contact-sheet.png, cola-export-verification.json, cola-eight-stickers.zip
- python-tests.txt, node-tests.txt

## Limits and publication handoff

No MCD_MCP_TOKEN was available, so Task 8 is intentionally skipped. No live order tool responses or true MCP usage eligibility are claimed. All packs and screenshots use synthetic fixtures or quiz data.

The cloud release gate is met. Task 9 publication, Pages build / online verification, contest Issue / bot response and the local work log remain for the authorized local Codex publishing flow using its existing authentication. The cloud did not perform another login.

qa.local.html and cdn-off.local.html are private, ignored inspection fixtures. They are excluded from git and the release source archive.
