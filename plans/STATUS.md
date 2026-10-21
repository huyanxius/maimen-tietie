# 麦门贴贴进度

更新时间：2026-10-21 11:40（北京时间）。开发、贴纸生成与首轮浏览器验证在云端完成；本机负责文件传输、使用已有 GitHub 认证发布和线上验收。

## 已完成

- Task 0–1：独立 main 仓库、仓库约定、唯一贴纸库（6 角色 / 4 反应 / 8 习惯）、忽略规则及官方原样声明。声明 SHA-256：cd28101bcb29cc8fb24b372fe91ce6b42c4a1487a54e01f7ade0c8c6a84241b7。
- Task 2–3：Python 标准库脚本、浏览器纯逻辑与跨语言固定 token 一致性。严格字段白名单、Unicode/base64url/编号验证；链接不能携带订单或任意额外字段。最终 Python 53 项、Node 32 项（29 core + 3 renderer）测试全绿。Python 3.9 语法检查通过；实际测试运行于 Python 3.12。
- Task 4：32 张正式原创纸贴纸全部完成（24 反应 + 8 习惯），均为 512×512 真透明 RGBA PNG；hero 为 1600×1000。使用内置 image_gen，沿用已确认角色与纸张风格。生成提示词、原图与成品 hash、透明度检查在 plans/artwork；32 张缩略总览已逐张检查，无商标或图中文字。
- Task 5：五题问答、可选昵称、配字编辑、分享链接回载、浏览器合成 240×240 透明 PNG 与 ZIP 导出完成。云 Chromium 在 390×844 和 1280×800 两个真实 CSS iframe 视口从首屏、五题、结果上下段、安装至页脚逐段检查，无横向溢出或遮挡。手机标题作了针对性换行修正。截图及测量说明见 plans/publish-check/QA.md。
- 浏览器回归：可乐 8 张与薯条 5 张问答结果符合规则；上一题保留答案，重新开始清空答案。9 字配字、违禁配字、13 字昵称被拦下且禁用导出/分享；有效 8 字配字完整绘制。分享 token 在新页面回载，完整 8 张 ZIP 实际下载并验证每张 240×240、RGBA、边界透明。此前规范化示例 5 张 ZIP 和 JSZip 本地 fallback 已验证。
- Task 6–7：SKILL.md、README.md、MCP_INTEGRATION.md、环境变量占位符配置模板完成，明确披露真实 MCP 尚未联调；没有把问答或示例数据冒充真实 MCP 调用。

## 跳过

- Task 8：没有可用的 MCD_MCP_TOKEN，按用户要求跳过。不索取或复制 Token，不编造真实订单、响应字段或联调结果。
- 官方已确认参赛登记成功，但该回执不构成真实 MCP 联调证据；当前只证明网页与规范化输入流程可用，真实联调仍待补充。

## 正式发布

- 公开仓库：https://github.com/huyanxius/maimen-tietie 。首次 main 推送为 dad8077ef7f3be1a3d4a839d637f3bf92030f599，与云端最终发布包一致。完整历史和 100 个已跟踪文件经核验，不含凭据、真实订单、私有 QA HTML 或恢复包。
- GitHub Pages：https://huyanxius.github.io/maimen-tietie/ 。发布源为 main 分支 /docs，HTTPS 已启用。首次构建状态为 built；页面、脚本、JSON 和全部贴纸等 40 个线上资源均返回 HTTP 200，且 SHA-256 与已核验发布文件一致。
- 线上 Chrome 验收：390×844 手机问答走完五题，生成可乐 8 张；1280×800 桌面查看结果与首屏。两个宽度的页面 scrollWidth 均等于视口宽度，没有横向溢出。8 字配字“今天也要好好休息”完整显示。
- 分享按钮显示复制成功；在新标签页打开生成的分享 URL，昵称、8 张贴纸及配字全部一致。
- 实际线上导出 ZIP：8 张均为 240×240 RGBA PNG，alpha 范围为 0–255，最外圈像素全部透明，文件名保留配字。ZIP SHA-256：8013a2ce1f331d6c49e28a46b535b02a40adcd01acdbf328ba7aaa96ff0eb138。
- 报名申请：https://github.com/M-China/mcd-developer-innovation-challenge/issues/942 。官方账号 M-China-Official 已[确认作品成功参赛](https://github.com/M-China/mcd-developer-innovation-challenge/issues/942#issuecomment-6304526424)。申请正文仍明确披露 Task 8 因无 Token 跳过、真实 MCP 尚未联调，不将参赛登记确认写成真实联调完成。
- 官方声明及活动规则与用户已确认的 242362e994c252ccdb0ebdd0fd78fd410efa7c78 版本完全一致。CONTEST_DECLARATION.md 保持原样。
- 本机使用新的隔离目录恢复和发布，没有覆盖原始项目目录，没有复制认证资料或要求重新登录。公开后的文档更新通过正常分支和 PR 提交。
- 文档记录 PR：https://github.com/huyanxius/maimen-tietie/pull/1 ，范围仅为 README.md 和 plans/STATUS.md。
- 本机工作日志已在分隔线下新增一行上线及参赛确认记录；写入后回读核验，其余内容保持不变。

## 用户醒来后

无需为了本次云端收尾登录。可以打开线上网页看一眼效果，愿意的话请朋友点 Star；麦当劳 MCP Token 可以后本人申请，再补真实联调。
