# 麦当劳 MCP 使用说明

## 当前验证状态

没有可用的 MCD_MCP_TOKEN，本次依用户指示跳过 Task 8。以下工具列表及调用顺序是 Skill 工作流的设计与实现，不是实际成功调用的记录。真实订单响应字段、分页与时间格式仍待本人账户联调确认；不虚构工具返回。网页问答和规范化示例数据可以独立运行。官方活动要求真实使用 MCP，当前不能据此宣称已满足该资格。

配置模板见 [mcp-config.example.json](mcp-config.example.json)，只含环境变量占位符。

## MCP Server

- 名称：麦当劳中国 MCP Server（`mcd-mcp`）
- 地址：`https://mcp.mcd.cn`
- 协议：Streamable HTTP，请求头 `Authorization: Bearer <MCP Token>`
- Token：用户本人在 open.mcd.cn 申请，本项目不保存、不回显

## Skill 计划调用的 Tool（待真实验证）

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
