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
