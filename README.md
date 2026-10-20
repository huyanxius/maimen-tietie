# 麦门贴贴 maimen-tietie

把你吃麦当劳的样子，做成一套能发的表情包。

![麦门贴贴](docs/stickers/img/hero.png)

**[在线玩一下 →](https://huyanxius.github.io/maimen-tietie/)** 不用登录，答 5 道题，当场拿到一套贴纸。

**当前验证范围：**问答模式、规范化示例订单、本地脚本及浏览器 PNG/ZIP 导出已完成验证；没有可用 Token，本次跳过真实麦当劳 MCP 联调。下方 MCP 调用流程是已实现的 Skill 工作流说明，不是已经成功调用的证据，也不代表已满足比赛的真实 MCP 使用资格。最终进度见 [plans/STATUS.md](plans/STATUS.md)。

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

仓库的 [mcp-config.example.json](mcp-config.example.json) 只含环境变量占位符；变量替换方式以你的客户端为准。请通过客户端安全配置读取 Token，不要提交真实值。

## 使用示例

对你的 Agent 说：

> 用麦门贴贴读我的麦当劳订单，做一套表情包。

它会告诉你本命角色、命中的习惯和依据，再给你一个链接。打开链接，电脑上点「下载全部」，手机上长按单张保存，然后在微信聊天里「添加到表情」。

## 隐私

- 订单只在你运行 Agent 的环境里分析，临时规范化文件在流程结束后删除。网页不接收原始订单。
- 分享链接里只有角色、贴纸编号、配字和昵称，没有任何订单数据。
- 默认只读，不会替你下单、领券或抽奖；只有你主动要求「再来一单」，并且当场确认，才会下单。

## 合规

角色全部原创，画面里没有麦当劳商标；配字只聊时间和口味，不拿吃了多少、身材开玩笑。本项目为参赛作品，非麦当劳官方产品。

## 开发

```bash
python3 -m unittest discover -s tests -v
node --test docs/app/core.test.mjs docs/app/render.test.mjs
python3 -m http.server 8000 -d docs
```

## 参赛说明

本项目参加「麦当劳程序员创意开发大赛」，参赛声明见 [CONTEST_DECLARATION.md](./CONTEST_DECLARATION.md)，MCP 使用说明见 [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)。

同系列：[logo-to-stickers](https://github.com/huyanxius/logo-to-stickers)，把 logo 变成会干活的纸贴纸。

喜欢这套贴纸的话，点个 Star 吧。
