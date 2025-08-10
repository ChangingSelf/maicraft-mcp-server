# Maicraft

一个基于Mineflayer的Minecraft MCP Server。

部分高级动作参考[mineland](https://github.com/cocacola-lab/MineLand)项目的实现。

---

### 核心能力
- 事件驱动的本地状态快照（`StateManager`）
- 统一动作执行器（`ActionExecutor`）
- MCP 标准工具暴露（`stdio` 传输）

---

### 快速开始
1) 安装
```bash
pnpm install
```

2) 复制配置
```bash
cp config-template.yaml config.yaml
```

3) 运行
```bash
pnpm run dev  -- ./config.yaml   # 开发（tsx）
pnpm run build && pnpm start     # 生产（tsc -> node）
```

项目默认启动 MCP Server（stdio 传输）。

---

### 配置示例（YAML）
```yaml
minecraft:
  host: "localhost"
  port: 25565
  username: "MaicraftBot"
  auth: "offline"
  # version: "1.20.1"

enabledEvents:
  - chat
  - playerJoin
  - blockBreak

maxMessageHistory: 100

mcp:
  name: "Maicraft MCP"
  version: "0.1.0"
  tools:
    enabled:
      - mine_block
      - place_block
      - follow_player
```

---

### MCP 工具
- ping: 健康检查，返回版本与就绪状态
- query_state: 返回 Bot 最小状态快照
- query_events: 支持 `type|since_ms|limit` 的最近事件查询
- mine_block: 按名称挖掘若干
- place_block: 在坐标处放置指定物品
- follow_player: 跟随指定玩家（可选距离/超时）

未改造的工具占位：`craft_item`/`smelt_item`/`open_chest`/`kill_mob`/`swim_to_land` 将返回 `not_implemented`。

---

### 使用 MCP Inspector 调试

本项目已内置 MCP Inspector 配置，便于在本地可视化调试 MCP 服务器。

参考工具仓库：[`modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector)

1) 准备
- 生产态建议先构建：`pnpm build`

2) UI 调试（生产态，推荐）

```bash
pnpm run inspect:ui:dist
```

如果需要手动在 UI 左侧填写参数，请使用：

```text
Transport: STDIO
Command:   node
Arguments: dist/main.js ./config.yaml
Env:       MCP_STDIO_MODE=1
```

3) UI 调试（开发态）

```bash
pnpm run inspect:ui:dev
```

或在 UI 左侧手动填写：

```text
Transport: STDIO
Command:   node
Arguments: --loader tsx src/main.ts ./config.yaml
Env:       MCP_STDIO_MODE=1
```

4) 命令行（CLI）探测

```bash
# 列出工具（生产态）
pnpm dlx @modelcontextprotocol/inspector@0.16.2 --cli --config mcp-inspector.json --server maicraft-dist --method tools/list

# 列出工具（开发态）
pnpm run inspect:cli:dev:tools

# 调用 ping（开发态）
pnpm run inspect:cli:dev:ping
```

5) 常见问题
- 点击 Connect 无反应，控制台出现 `Unexpected token '>'`、`Unexpected end of JSON input`：通常是使用包管理器脚本（如 pnpm run）导致提示文本写入 stdout，污染了 MCP 的 stdio 协议。请改用上面的“直接 node/tsx 启动”的命令形式，或选择 `maicraft-dist`/`maicraft-dev` 预置项。
- 表单仍显示旧命令：在左侧 `Servers File` 重新选择仓库根目录的 `mcp-inspector.json`，或在左下角 `System` 菜单执行 Reset/Clear。

Inspector 的配置文件位于根目录 `mcp-inspector.json`，已预置 `stdio` 与 `MCP_STDIO_MODE=1` 环境变量。

---

### 在 Node 中以 stdio 连接 MCP（示例）
```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/main.js", "./config.yaml"],
});

const client = new Client({ name: "demo-client", version: "1.0.0" });
await client.connect(transport);

console.log(await client.callTool({ name: "ping", arguments: {} }));
console.log(await client.callTool({ name: "query_state", arguments: {} }));
console.log(await client.callTool({ name: "query_events", arguments: { limit: 10 } }));
```

---

### 扩展动作
实现 `ActionInterface` 并通过 `MaicraftClient.registerAction` 注册即可（参见 `src/actions/*` 与导出的类型）。
