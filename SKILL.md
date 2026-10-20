---
name: maimen-tietie
description: 麦门贴贴。读用户的麦当劳订单（麦当劳 MCP），找出本命餐和吃麦当劳的习惯，生成一套能加进微信的纸贴纸表情包。用户说“做一套麦当劳表情包”“麦门贴贴”“看看我的麦门人设”时使用。
---

# 麦门贴贴

把一个人吃麦当劳的样子，变成一套能在群里发的表情包。

需要已接入麦当劳 MCP（服务名 `mcd-mcp`，地址 `https://mcp.mcd.cn`）。没接入时，告诉用户按 README 配置，或者先去网页问答模式玩：https://huyanxius.github.io/maimen-tietie/#play 。不要编造订单。

## 当前状态

本版本尚未使用真实 Token 完成 MCP 联调。不要假定订单响应字段；先根据实际工具 schema 和返回内容核对下单时间、餐品名、份数与分页，再规范化。不把示例订单或问答结果说成真实分析。

## 流程

1. 调 `now-time-info` 确认当前时间。
2. 调 `order-list` 取最近的订单，目标 10–30 单。订单里没有餐品名时，用 `query-order` 补，整次最多补 20 单。
3. 只保留每单的下单时间（北京时间，`YYYY-MM-DD HH:MM`）和餐品名、份数，写进仅当前用户可读的临时文件（例如随机命名的 `/tmp/maimen-orders-<随机串>.json`，权限 600）：

   ```json
   {"orders": [{"time": "2026-10-05 07:40", "items": [{"name": "猪柳麦满分", "qty": 1}]}]}
   ```

   地址、电话、价格、订单号一律不写。

4. 运行：

   ```bash
   python3 scripts/tietie.py link /tmp/maimen-orders-<随机串>.json --name "用户想要的昵称"
   ```

   昵称可以不给。退出码为 1 且提示订单太少时，把网页问答模式的链接给用户。

5. 用自然的话告诉用户：本命角色是谁；命中了哪些习惯，每个习惯带上脚本给的证据（比如「5 单里 3 单在早上 9:30 前」）；然后给出 `link`。说明用法：电脑上点「下载全部」，手机上长按单张保存，再在微信聊天里「添加到表情」。
6. 用户想改配字：把输出里的 `pack` 存成文件，改 `caption`（1–8 个字），运行 `python3 scripts/tietie.py encode 文件路径` 拿新链接。也可以让用户直接在网页上点配字修改。
7. 无论成功、中断还是生成失败，都删除这次的临时订单文件。不要读取、删除其他任务同名文件，也不要把原始订单写入仓库或分享链接。

## 可选：再来一单本命餐

只有用户主动提出时才做：用 `query-nearby-stores`（或外送流程的 `delivery-query-addresses`、`delivery-query-stores`）定门店 → `query-meals` 找到本命餐 → `calculate-price` 算价并展示 → 用户明确说确认 → `create-order`，把支付链接交给用户本人支付。

## 约定

- 默认只读。`create-order`、`cancel-order`、`auto-bind-coupons`、`draw-lottery`、`mall-create-order` 没有用户当场明确同意一律不调。
- 人设只谈时间和口味，不评论体重、身材，不拿「吃了多少」开玩笑。
- 链接里只有角色、贴纸编号、配字和昵称，不含订单数据；不要把订单写进其他文件。
- 不在对话里回显 MCP Token。
