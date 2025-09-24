# Maicraft

基于 [mineflayer](https://github.com/PrismarineJS/mineflayer) 构建的 Minecraft MCP Server。

主要用于和[Amaidesu](https://github.com/MaiM-with-u/Amaidesu)项目配合（maicraft插件现已独立成新的仓库[MaiM-with-u/Maicraft](https://github.com/MaiM-with-u/Maicraft)），让[MaiBot](https://github.com/MaiM-with-u/MaiBot)游玩Minecraft游戏。

当然，也可以像普通MCP Server一样使用本项目。

部分高级动作的实现参考自 [mineland](https://github.com/cocacola-lab/MineLand)

## 安装

请提前配置好minecraft服务器，无论是minecraft客户端直接开局域网游戏，或是minecraft服务器，都支持，版本会自动检测。

推荐的游戏版本：1.20.4

1.21.4也支持，但mineflayer在此版本有些问题，更高的版本可能会有问题，1.21.8目前测出来是不支持的。

### 方法一：使用npx执行npm包来配置

```json
{
  "mcpServers": {
    "maicraft": {
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "maicraft@latest",
        "--host","127.0.0.1",
        "--port","25565",
        "--username","Mai",
         "--auth", "offline"
      ]
    }
  }
}

```

这里的@latest表示使用最新版本，你也可以替换为其他版本。

### 方法二：提前全局下载

你可以提前全局安装maicraft，然后再按照方法一进行配置，这样启动时会使用你全局下载的maicraft而不是npx下载的，这样可以避免调用它的时候过慢（因为需要临时下载），缺点是你需要手动升级。

```bash
npm install maicraft -g
```

### 方法三：本地构建

当你的网络不太好，可以使用本地构建。首先clone本地项目

```bash
git clone git@github.com:ChangingSelf/maicraft-mcp-server.git
cd maicraft-mcp-server
pnpm install
pnpm run build
```

然后配置为：

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "node",
      "args": [
        "/path/to/maicraft-mcp-server/dist/main.js",
        "--host",
        "localhost",
        "--port",
        "25565",
        "--username",
        "EvilMai",
      ]
    }
  }
}
```

如果你不想每次都 `pnpm run build`，也可以直接指定为 `main.ts`，只不过需要tsx来执行

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "npx",
      "args": [
        "tsx"
        "/path/to/maicraft-mcp-server/src/main.ts",
        "--host",
        "localhost",
        "--port",
        "25565",
        "--username",
        "EvilMai",
      ]
    }
  }
}
```

## 配置

Maicraft 支持两种配置方式：命令行参数和配置文件。

### 方式一：命令行参数（推荐）

最简单的方式是直接在启动时使用命令行参数，无需创建配置文件：

```bash
# 基本连接参数
--host <地址>           # Minecraft 服务器地址（默认：127.0.0.1）
--port <端口>           # 服务器端口（默认：25565）
--username <用户名>     # 机器人用户名
--auth <认证方式>       # offline | microsoft | mojang（默认：offline）

# 日志配置
--log-level <级别>      # DEBUG | INFO | WARN | ERROR（默认：INFO）

# 事件过滤
--events-disabled <事件列表>  # 要禁用的事件，用逗号分隔
```

**快速开始示例：**

```bash
# 连接本地服务器
npx -y maicraft --host 127.0.0.1 --username MyBot

# 连接远程服务器并启用调试日志
npx -y maicraft --host mc.example.com --port 25565 --username Bot --log-level DEBUG

# 禁用聊天事件减少噪音
npx -y maicraft --host 127.0.0.1 --username Bot --events-disabled chat,playerJoined
```

### 方式二：配置文件（适合复杂配置）

如果你需要复杂的配置，或者想保存配置以便重复使用，可以使用配置文件：

首先获取配置文件模板：

#### npx 用户

```bash
# 复制配置文件模板到当前目录
npx -y maicraft --init-config
```

#### 源码安装用户

```bash
# 复制配置文件模板
cp config-template.yaml config.yaml
```

然后编辑 `config.yaml` 配置你的设置：

```yaml
minecraft:
  host: 127.0.0.1        # Minecraft 服务器地址
  port: 25565            # 服务器端口
  username: MaiBot       # 机器人用户名
  auth: offline          # 认证方式：offline | microsoft | mojang

# 日志配置
logging:
  level: INFO            # 日志级别：DEBUG | INFO | WARN | ERROR
  enableFileLog: true    # 是否启用文件日志
  useStderr: true        # MCP 模式建议开启

# 可选：禁用特定事件
disabledEvents:
  - chat                 # 聊天事件
  - playerJoined         # 玩家加入
  # - death              # 其他事件...

# 其他高级配置...
# ……
```

**提示：** 你也可以混合使用两种方式，先用配置文件设置基础配置，再用命令行参数覆盖特定设置。

## 启动

现在你可以直接启动 Maicraft：

#### 方式一：npx 用户

```bash
# 直接启动（结合上面的命令行参数使用）
npx -y maicraft --host 127.0.0.1 --username MyBot

# 或使用配置文件启动
npx -y maicraft /path/to/config.yaml
```

#### 方式二：源码安装用户

```bash
# 开发模式（热重载，适合开发调试）
pnpm dev

# 生产模式（需要先构建）
pnpm build
pnpm start
```

启动成功后，你会看到类似以下的输出：

````
[INFO] Maicraft 客户端已启动，按 Ctrl+C 退出
[INFO] 日志文件位置: /path/to/logs/maicraft-2024-01-15T10-30-00.log
[INFO] WebSocket日志服务器已启动: ws://localhost:20915/ws/mcp-logs
````

## 测试

#### 方式一：npx 用户

```bash
# 需要先安装mcp-inspector
npm install -g @modelcontextprotocol/inspector

# 列出已注册的工具
mcp-inspector --cli --config mcp-inspector.json --server maicraft --method tools/list

# 调用 query_state 进行烟囱测试
mcp-inspector --cli --config mcp-inspector.json --server maicraft --method tools/call --tool-name query_state
```

#### 方式二：源码安装用户

```bash
# 列出已注册的工具
pnpm mcp:tools

# 调用 query_state 进行烟囱测试
pnpm mcp:state
```

## 快速调试

### 方法一：直接调试

无需下载任何源码，直接运行如下命令：

```bash
npx @modelcontextprotocol/inspector@0.16.5 npx -y maicraft@latest --host ChangingSelf.xyz --port 50226 --username MaiBot --auth offline
```

之后会弹出一个浏览器网页，点击这个网页左下角的“connect”按钮，若右侧出现“List Tools”的按钮，说明成功配置好了，可以直接通过UI界面进行调试操作。

指定inspector的0.16.5版本的原因是，左下角会有stderr的输出。本mcp server支持的是stdio类型，所以为了避免日志影响stdio，这里将所有的日志都重定向到了stderr。

### 方法二：源码调试

如果你已经克隆了项目源码，可以直接使用源码进行调试：

```bash
# 克隆项目（如果还没有）
git clone https://github.com/ChangingSelf/Maicraft.git
cd Maicraft

# 安装依赖
pnpm install

# 启动调试界面（开发模式）
pnpm mcp:ui
```

这会启动一个基于源码的调试界面，无需打包，直接运行TypeScript源码。

如果你需要更灵活的调试，也可以手动配置：

创建mcp-inspector.json配置文件

```json
{
  "mcpServers": {
    "maicraft": {
      "type": "stdio",
      "command": "tsx",
      "args": ["src/main.ts", "./config.yaml"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

```bash
# 启动调试界面
mcp-inspector --config mcp-inspector.json --server maicraft
```

## 日志输出

Maicraft 提供多种方式查看日志：控制台输出、文件日志、WebSocket 实时流。

### 日志文件

日志文件默认保存在项目根目录的 `logs/` 文件夹中，文件名格式为：

````
logs/maicraft-YYYY-MM-DDTHH-mm-ss.log
````

### WebSocket 日志流

程序启动时会自动启动 WebSocket 服务器，用于实时传输日志：

- **端点**: `ws://localhost:20915/ws/mcp-logs`
- **默认端口**: 20915
- **用途**: 用于 [maicraft-web-ui](https://github.com/ChangingSelf/maicraft-web-ui) 等工具实时查看日志

可以通过配置修改 WebSocket 服务器设置：

```yaml
websocket:
  enabled: true           # 是否启用WebSocket日志服务器
  port: 20915             # WebSocket服务器端口
  host: "localhost"       # WebSocket服务器监听地址
```

## 架构

```mermaid
graph LR
  A[main.ts 启动器] -->|读取| C[config.yaml]
  A --> L[Logger]
  A --> MC[MinecraftClient]
  A --> AE[ActionExecutor]
  A --> MCP[MaicraftMcpServer]

  MC -->|使用| B[mineflayer Bot]
  B -->|事件| MC
  MC -->|gameEvent| A

  MCP -->|动作工具| AE
  MCP -->|连接/状态| MC
  AE -->|使用 Bot 执行动作| B
  
  AE -->|自动发现| ACT[src/actions/*.ts]
  ACT -->|schema + execute| AE
  AE -->|自动生成| MCP_TOOLS[MCP Tools]
```

### 动作系统架构

```mermaid
graph TD
  A[Action File] -->|继承| B[BaseAction]
  A -->|定义| C[schema: z.ZodTypeAny]
  A -->|实现| D[execute: bot, params => Promise&lt;ActionResult&gt;]
  
  B -->|自动提供| E[validateParams]
  B -->|自动提供| F[getParamsSchema]
  B -->|自动提供| G[getMcpTools]
  
  G -->|生成| H[MCP Tool: action_name_snake_case]
  C -->|校验| I[参数类型安全]
  C -->|描述| J[自动生成参数文档]
```

### 时序：调用动作（mine_block）

```mermaid
sequenceDiagram
  participant Client as MCP Client
  participant Server as MaicraftMcpServer
  participant AE as ActionExecutor
  participant MC as MinecraftClient
  participant Bot as mineflayer Bot

  Client->>Server: tools/call mine_block
  Server->>MC: getBot()
  MC-->>Server: Bot
  alt Bot ready
    Server->>AE: execute('mineBlock', Bot, params)
    AE->>Bot: 动作执行（寻路/采集等）
    Bot-->>AE: result
    AE-->>Server: { success, data }
    Server-->>Client: structuredContent
  else Bot not ready
    Server-->>Client: { ok:false, error: service_unavailable }
  end
```

### 时序：事件处理

```mermaid
sequenceDiagram
  participant Bot as mineflayer Bot
  participant MC as MinecraftClient
  participant Main as main.ts

  Bot->>MC: 原始游戏事件
  MC->>MC: 过滤 disabledEvents（黑名单）
  MC-->>Main: gameEvent
```

## 详细配置

### 命令行参数

Maicraft 支持多种命令行参数，可以覆盖配置文件中的设置：

```bash
# 基础连接参数
--host <地址>           # Minecraft 服务器地址（默认：127.0.0.1）
--port <端口>           # 服务器端口（默认：25565）
--username <用户名>     # 机器人用户名
--password <密码>       # 服务器密码（在线模式需要）
--auth <认证方式>       # offline | microsoft | mojang（默认：offline）
--version <版本>        # Minecraft 版本（可选，自动检测）

# 日志配置
--log-level <级别>      # DEBUG | INFO | WARN | ERROR（默认：INFO）

# 事件过滤（黑名单机制）
--events-disabled <事件列表>  # 要禁用的事件类型，用逗号分隔
                              # 示例：--events-disabled chat,playerJoined,health
                              # 支持的事件：chat, playerJoined, playerLeft, death, spawn, rain, kicked, spawnReset, health, entityHurt, entityDead, playerCollect

# MCP 配置
--mcp-name <名称>       # MCP 服务器名称
--mcp-version <版本>    # MCP 服务器版本

# 工具过滤
--tools-enabled <工具列表>    # 启用的 MCP 工具列表（白名单）
--tools-disabled <工具列表>  # 禁用的 MCP 工具列表（黑名单）
```

#### 事件禁用参数示例

```bash
# 禁用聊天和玩家加入事件
npx -y maicraft --events-disabled chat,playerJoined

# 禁用所有生命值相关事件
npx -y maicraft --events-disabled health,entityHurt,entityDead

# 禁用天气和玩家收集事件
npx -y maicraft --events-disabled rain,playerCollect
```

### 基础配置

在 `config.yaml` 中配置 Minecraft 服务器连接：

```yaml
minecraft:
  host: 127.0.0.1        # 服务器地址
  port: 25565            # 端口
  username: MaiBot       # 机器人用户名
  auth: offline          # 认证方式：offline | microsoft | mojang
  version: "1.19.0"      # 游戏版本（可选）

# 禁用的事件类型列表（黑名单机制）
# 列出要禁用的游戏事件类型，默认情况下所有事件都会被启用
disabledEvents:
  # - chat                 # 聊天事件
  # - playerJoined         # 玩家加入
  # - playerLeft           # 玩家离开
  # - death                # 玩家死亡
  # - spawn                # 玩家重生
  # - rain                 # 天气变化
  # - kicked               # 玩家被踢出
  # - spawnReset           # 重生点重置
  # - health               # 生命值更新
  # - entityHurt           # 实体受伤
  # - entityDead           # 实体死亡
  # - playerCollect        # 玩家收集物品

# 不能破坏的方块列表配置
# 机器人路径查找时会避免破坏这些方块
blocksCantBreak:
  - chest        # 箱子
  - furnace      # 熔炉
  - bed          # 床
  - door         # 门
  - trapdoor     # 活板门
  - sign         # 告示牌
  - torch        # 火把
  - lantern      # 灯笼

maxMessageHistory: 100   # 事件历史缓存数量

# 视图管理器配置（用于截图功能）
viewer:
  width: 1920              # 截图宽度
  height: 1080             # 截图高度
  fov: 70                  # 视野角度
  renderDistance: 8        # 渲染距离
```

### 路径查找配置

#### 不能破坏的方块列表

`blocksCantBreak` 配置项用于指定机器人在路径查找时不能破坏的方块列表。当机器人需要移动到某个位置时，它会避免破坏这些重要的方块。

```yaml
# 不能破坏的方块列表配置
blocksCantBreak:
  - chest        # 箱子
  - furnace      # 熔炉
  - bed          # 床
  - door         # 门
  - trapdoor     # 活板门
  - sign         # 告示牌
  - torch        # 火把
  - lantern      # 灯笼
```

**配置说明：**

- 如果不配置此选项，将使用默认列表：`['chest', 'furnace']`
- 可以设置为空数组 `[]` 来允许破坏所有方块
- 方块名称使用 Minecraft 的英文名称（如 `chest`、`furnace` 等）
- 如果配置了未知的方块名称，会在日志中显示警告信息

**常见方块名称参考：**

- `chest` - 箱子
- `furnace` - 熔炉
- `crafting_table` - 工作台
- `bed` - 床
- `door` - 门
- `trapdoor` - 活板门
- `sign` - 告示牌
- `torch` - 火把
- `lantern` - 灯笼
- `anvil` - 铁砧
- `enchanting_table` - 附魔台
- `brewing_stand` - 酿造台

### 视图管理器配置

Maicraft 支持生成第一人称视角的游戏截图，需要配置视图管理器：

```yaml
# 视图管理器配置（用于截图功能）
viewer:
  width: 1920              # 截图宽度，默认 1920
  height: 1080             # 截图高度，默认 1080
  fov: 70                  # 视野角度，默认 70
  renderDistance: 8        # 渲染距离，默认 8
```

#### 配置说明

- **width/height**：截图分辨率，影响截图质量和文件大小
- **fov**：视野角度，影响视角范围（30-120度）
- **renderDistance**：渲染距离，影响截图中可见的方块范围

#### 使用说明

- 截图功能需要 Canvas 支持，可能需要安装系统依赖
- 生成的截图为 base64 格式的 PNG 图片
- 截图会自动同步相机位置，确保第一人称视角

### MCP 工具配置

Maicraft 支持多种工具过滤模式，推荐使用黑名单模式：

```yaml
mcp:
  name: "Maicraft MCP"
  version: "1.0.0"
  tools:
    # 方式1：黑名单模式（推荐）- 屏蔽指定工具，其他全部可用
    disabled:
      - use_chest
      - smelt_item
    
    # 方式2：白名单模式 - 仅暴露指定工具
    # enabled:
    #   - mine_block
    #   - place_block
    #   - follow_player
    
    # 方式3：同时使用 - 白名单允许的集合减去黑名单
    # enabled:
    #   - mine_block
    #   - place_block
    #   - chat
    # disabled:
    #   - chat
    
    # 方式4：不配置 - 默认暴露所有工具
    # （删除或注释掉 tools 部分）
```

## 动作开发

### 动作系统特性

- **自动发现**：将动作文件放在 `src/actions/` 目录即可自动发现
- **参数校验**：基于 Zod 的自动参数校验
- **类型安全**：完整的 TypeScript 类型支持
- **MCP 集成**：自动生成对应的 MCP 工具

### 编写新动作

#### 方式1：继承基类（推荐）

```typescript
// src/actions/MyAction.ts
import { BaseAction } from '../minecraft/ActionInterface';
import { z } from 'zod';

interface MyActionParams {
  target: string;
  count?: number;
}

export class MyAction extends BaseAction<MyActionParams> {
  name = 'myAction';
  description = '执行我的自定义动作';
  
  // 定义参数校验 schema
  schema = z.object({
    target: z.string().describe('目标对象'),
    count: z.number().int().min(1).optional().describe('执行次数（可选）'),
  });

  async execute(bot: Bot, params: MyActionParams) {
    try {
      // 实现动作逻辑
      const count = params.count ?? 1;
      
      // ... 具体实现
      
      return this.createSuccessResult(`成功执行动作 ${count} 次`);
    } catch (error) {
      return this.createExceptionResult(error, '执行失败', 'EXECUTION_ERROR');
    }
  }
  
  // validateParams、getParamsSchema、getMcpTools 由基类自动提供
}
```

#### 方式2：函数式定义

```typescript
// src/actions/MyAction.ts
import { defineAction } from '../minecraft/ActionInterface';
import { z } from 'zod';

export const MyAction = defineAction({
  name: 'myAction',
  description: '执行我的自定义动作',
  schema: z.object({
    target: z.string().describe('目标对象'),
    count: z.number().int().min(1).optional().describe('执行次数（可选）'),
  }),
  async execute(bot, params) {
    // 实现动作逻辑
    const count = params.count ?? 1;
    
    // ... 具体实现
    
    return { success: true, message: `成功执行动作 ${count} 次` };
  },
});
```

### 动作自动注册

1. 将动作文件放在 `src/actions/` 目录
2. 文件会被自动发现并注册
3. 对应的 MCP 工具会自动生成（工具名为动作名的 snake_case 形式）
4. 例如：`MyAction` → `my_action` 工具

### 动作开发最佳实践

#### 1. 参数设计原则

- 使用清晰的参数名称，避免缩写
- 为可选参数提供合理的默认值
- 使用 Zod schema 进行严格的参数校验
- 在参数描述中提供示例和说明

#### 2. 错误处理

- 使用 `createErrorResult()` 返回业务逻辑错误
- 使用 `createExceptionResult()` 返回异常错误
- 提供有意义的错误代码和消息
- 记录详细的调试日志

#### 3. 返回值设计

- 使用 `createSuccessResult()` 返回成功结果
- 在返回数据中包含有用的状态信息
- 保持返回格式的一致性

#### 4. 依赖检查

- 检查必要的插件是否已加载（如 pathfinder）
- 验证目标对象是否存在（如方块、玩家、实体）
- 确保背包中有必要的物品

#### 5. 性能考虑

- 设置合理的超时时间
- 限制搜索范围（如 maxDistance）
- 避免无限循环和长时间阻塞

### 可用的动作工具

当前支持的动作工具：

#### 基础交互动作

- **`chat`** **chat** **chat** - 发送聊天消息

  - 参数：`message` (字符串) - 要发送的聊天消息

- **`basic_control`** **basic_control** **basic_control** - 基础游戏控制功能

  - 参数：

    - `type` (字符串) - 控制类型：`toss` | `move` | `jump` | `sneak` | `look_at` | `sleep` | `wake` | `stop_move` | `stop_sneak`
    - `item` (字符串，可选) - 物品名称或ID (用于 toss 类型)
    - `count` (数字，可选) - 物品数量 (用于 toss 类型，默认 1)
    - `direction` (字符串，可选) - 移动方向 (用于 move 类型：`forward` | `back` | `left` | `right`)
    - `lookType` (字符串，可选) - 注视类型 (用于 look_at 类型：`angle` | `position` | `player` | `entity` | `block`)
    - `yaw` (数字，可选) - 视角偏航角，弧度 (用于 angle 注视类型)
    - `pitch` (数字，可选) - 视角俯仰角，弧度 (用于 angle 注视类型)
    - `x`, `y`, `z` (数字，可选) - 目标坐标 (用于 position 注视类型)
    - `force` (布尔值，可选) - 是否强制看向 (用于所有注视类型，默认 false)
    - `player` (字符串，可选) - 目标玩家名称 (用于 player 注视类型)
    - `entity` (字符串，可选) - 目标实体类型 (用于 entity 注视类型)，例如 cow, pig, zombie 等
    - `block` (字符串，可选) - 目标方块名称 (用于 block 注视类型)，例如 dirt, stone, diamond_ore 等
    - `maxDistance` (数字，可选) - 搜索距离 (用于 entity 和 block 注视类型，默认 64)


- **`use_item`** **use_item** **use_item** - 使用手中物品

  - 参数：

    - `itemName` (字符串，可选) - 物品名称，不指定则使用当前手持物品
    - `useType` (字符串，可选) - 使用类型：`consume` | `activate` | `useOn`，默认为根据物品类型自动判断
    - `targetEntityName` (字符串，可选) - 目标实体名称，仅在使用 `useOn` 类型时需要
    - `targetPlayerName` (字符串，可选) - 目标玩家名称，仅在使用 `useOn` 类型时需要
    - `offHand` (布尔值，可选) - 是否使用副手，默认 false





#### 移动与导航动作

- **`move`** **move** **move** - 移动到指定位置

  - 参数：

    - `type` (字符串) - 移动类型：`coordinate` | `block` | `player` | `entity`
    - `useAbsoluteCoords` (布尔值，可选) - 是否使用绝对坐标，默认 false
    - `x`, `y`, `z` (数字，可选) - 目标坐标 (当 type 为 coordinate 时必需)
    - `block` (字符串，可选) - 目标方块名称 (当 type 为 block 时必需)
    - `player` (字符串，可选) - 目标玩家名称 (当 type 为 player 时必需)
    - `entity` (字符串，可选) - 目标实体类型 (当 type 为 entity 时必需)
    - `distance` (数字，可选) - 到达距离，默认 1
    - `timeout` (数字，可选) - 超时时间(秒)，默认 60
    - `maxDistance` (数字，可选) - 最大移动距离，默认 100


- **`follow_player`** **follow_player** **follow_player** - 跟随指定玩家

  - 参数：

    - `player` (字符串) - 目标玩家名称
    - `distance` (数字，可选) - 跟随距离(格)，默认 3
    - `timeout` (数字，可选) - 超时时间(秒)，默认 5


- **`swim_to_land`** **swim_to_land** **swim_to_land** - 游向最近的陆地

  - 参数：

    - `maxDistance` (数字，可选) - 最大搜索距离，默认 64
    - `timeout` (数字，可选) - 超时时间(秒)，默认 60





#### 方块操作动作

- **`mine_block`** **mine_block** **mine_block** - 挖掘指定类型的方块

  - 参数：

    - `name` (字符串) - 方块名称，例如 "dirt", "stone", "coal_ore"
    - `count` (数字，可选) - 需要挖掘的数量，默认 1
    - `direction` (字符串，可选) - 挖掘方向：`+y` | `-y` | `+z` | `-z` | `+x` | `-x`（坐标轴方向），不指定时在附近搜索
    - `maxDistance` (数字，可选) - 搜索距离，默认 48
    - `bypassAllCheck` (布尔值，可选) - 是否绕过所有检查直接挖掘，默认 false


- **`place_block`** **place_block** **place_block** - 在指定位置放置方块

  - 参数：

    - `x`, `y`, `z` (数字) - 目标位置坐标
    - `block` (字符串) - 要放置的方块名称
    - `face` (字符串，可选) - 放置面向：`+y` | `-y` | `+z` | `-z` | `+x` | `-x`（坐标轴方向）
    - `useAbsoluteCoords` (布尔值，可选) - 是否使用绝对坐标，默认 false





#### 物品制作动作

- **`craft_item`** **craft_item** **craft_item** - 合成指定物品

  - 参数：

    - `item` (字符串) - 要合成的物品名称
    - `count` (数字，可选) - 合成数量，默认 1


- **`start_smelting`** **start_smelting** **start_smelting** - 在熔炉中开始熔炼物品（不等待完成）

  - 参数：

    - `item` (字符串) - 要熔炼的物品名称
    - `fuel` (字符串) - 燃料物品名称
    - `count` (数字，可选) - 熔炼数量，默认 1


- **`collect_smelted_items`** **collect_smelted_items** **collect_smelted_items** - 从熔炉中收集已熔炼完成的物品

  - 参数：

    - `item` (字符串，可选) - 要收集的熔炼产物名称，不指定则收集所有产物
    - `x`, `y`, `z` (数字，可选) - 熔炉坐标
    - `useAbsoluteCoords` (布尔值，可选) - 是否使用绝对坐标，默认 false


- **`use_furnace`** **use_furnace** **use_furnace** - 熔炉操作（放入/取出/查看物品）

  - 参数：

    - `container_type` (字符串，可选) - 容器类型：`furnace` | `blast_furnace` | `smoker` (默认 furnace)
    - `action` (字符串，可选) - 操作类型：`put` | `take` | `view` (默认 put)
    - `items` (数组，可选) - 物品数组 (put操作必需，take操作可选用于指定槽位)

      - `name` (字符串，可选) - 物品名称 (put操作必需)
      - `count` (数字，可选) - 物品数量 (默认 1)
      - `position` (字符串，可选) - 槽位：`input` | `fuel` | `output`

    - `x`, `y`, `z` (数字，可选) - 熔炉坐标
    - `auto_search` (布尔值，可选) - 是否自动查找附近容器 (默认 false)


- **`smelt_item`** **smelt_item** **smelt_item** - 在熔炉中熔炼物品（已弃用，建议使用 start_smelting + collect_smelted_items）

  - 参数：

    - `item` (字符串) - 要熔炼的物品名称
    - `fuel` (字符串) - 燃料物品名称
    - `count` (数字，可选) - 熔炼数量，默认 1





#### 存储与交互动作

- **`use_chest`** **use_chest** **use_chest** - 与附近箱子交互，存取物品

  - 参数：

    - `action` (字符串) - 操作类型：`store` | `withdraw`
    - `item` (字符串) - 物品名称
    - `count` (数字，可选) - 数量，默认 1





#### 战斗动作

- **`kill_mob`** **kill_mob** **kill_mob** - 击杀指定名称的生物

  - 参数：

    - `mob` (字符串) - 目标生物名称，例如 "cow", "pig", "zombie"
    - `timeout` (数字，可选) - 等待生物死亡的超时时间(秒)，默认 300





#### 其他动作

- **`screenshot`** **screenshot** **screenshot** - 生成当前时刻的第一人称截图

  - 参数：无参数，通过配置文件控制截图设置
  - 返回：base64格式的截图数据


### 动作使用示例

#### 基础操作示例

```json
// 发送聊天消息
{
  "tool": "chat",
  "arguments": {
    "message": "Hello, Minecraft!"
  }
}

// 食用苹果
{
  "tool": "use_item",
  "arguments": {
    "itemName": "apple",
    "useType": "consume"
  }
}

// 扔雪球
{
  "tool": "use_item",
  "arguments": {
    "itemName": "snowball",
    "useType": "activate"
  }
}

// 使用当前手持物品（自动判断使用类型）
{
  "tool": "use_item",
  "arguments": {}
}

// 丢弃物品
{
  "tool": "basic_control",
  "arguments": {
    "type": "toss",
    "item": "dirt",
    "count": 5
  }
}

// 开始向前移动
{
  "tool": "basic_control",
  "arguments": {
    "type": "move",
    "direction": "forward"
  }
}

// 执行跳跃
{
  "tool": "basic_control",
  "arguments": {
    "type": "jump"
  }
}

// 开始潜行
{
  "tool": "basic_control",
  "arguments": {
    "type": "sneak"
  }
}

// 调整视角到特定角度
{
  "tool": "basic_control",
  "arguments": {
    "type": "look_at",
    "lookType": "angle",
    "yaw": 1.57,
    "pitch": 0.0,
    "force": true
  }
}

// 看向特定坐标位置
{
  "tool": "basic_control",
  "arguments": {
    "type": "look_at",
    "lookType": "position",
    "x": 100,
    "y": 64,
    "z": 100,
    "force": true
  }
}

// 看向玩家
{
  "tool": "basic_control",
  "arguments": {
    "type": "look_at",
    "lookType": "player",
    "player": "Steve",
    "force": true
  }
}

// 看向最近的牛
{
  "tool": "basic_control",
  "arguments": {
    "type": "look_at",
    "lookType": "entity",
    "entity": "cow",
    "maxDistance": 50
  }
}

// 看向最近的钻石矿石方块
{
  "tool": "basic_control",
  "arguments": {
    "type": "look_at",
    "lookType": "block",
    "block": "diamond_ore",
    "maxDistance": 100
  }
}

// 睡觉（自动寻找附近的床）
{
  "tool": "basic_control",
  "arguments": {
    "type": "sleep"
  }
}

// 醒来
{
  "tool": "basic_control",
  "arguments": {
    "type": "wake"
  }
}

// 停止移动
{
  "tool": "basic_control",
  "arguments": {
    "type": "stop_move"
  }
}

// 停止潜行
{
  "tool": "basic_control",
  "arguments": {
    "type": "stop_sneak"
  }
}

// 对玩家使用物品
{
  "tool": "use_item",
  "arguments": {
    "itemName": "saddle",
    "useType": "useOn",
    "targetPlayerName": "Steve"
  }
}

// 对实体使用物品
{
  "tool": "use_item",
  "arguments": {
    "itemName": "shears",
    "useType": "useOn",
    "targetEntityName": "sheep"
  }
}

// 挖掘石头
{
  "tool": "mine_block",
  "arguments": {
    "name": "stone",
    "count": 5
  }
}

// 向Y轴正方向挖掘石头
{
  "tool": "mine_block",
  "arguments": {
    "name": "stone",
    "count": 3,
    "direction": "+y"
  }
}

// 向Z轴负方向挖掘煤炭
{
  "tool": "mine_block",
  "arguments": {
    "name": "coal_ore",
    "count": 2,
    "direction": "-z",
    "maxDistance": 20
  }
}

// 移动到指定坐标
{
  "tool": "move",
  "arguments": {
    "type": "coordinate",
    "x": 100,
    "y": 64,
    "z": 200,
    "useAbsoluteCoords": true
  }
}
```

#### 高级操作示例

> **💡 熔炼优化提示**：为了优化熔炼体验并避免长时间等待，建议使用 `start_smelting` + `collect_smelted_items` 的组合替代 `smelt_item`。这样可以：
> 
> - 开始熔炼后立即返回，不阻塞其他操作
> - 在熔炼进行时执行其他任务
> - 熔炼完成后单独收集产物

```json
// 合成工作台
{
  "tool": "craft_item",
  "arguments": {
    "item": "crafting_table",
    "count": 1
  }
}

// 开始熔炼铁矿石（推荐方式）
{
  "tool": "start_smelting",
  "arguments": {
    "item": "iron_ore",
    "fuel": "coal",
    "count": 3
  }
}

// 收集熔炼产物
{
  "tool": "collect_smelted_items",
  "arguments": {
    "item": "iron_ingot"
  }
}

// 熔炼铁矿石（已弃用，会等待熔炼完成）
{
  "tool": "smelt_item",
  "arguments": {
    "item": "iron_ore",
    "fuel": "coal",
    "count": 3
  }
}

// 熔炉操作示例
{
  "tool": "use_furnace",
  "arguments": {
    "action": "put",
    "items": [
      {"name": "iron_ore", "count": 5, "position": "input"},
      {"name": "coal", "count": 2, "position": "fuel"}
    ]
  }
}

// 查看熔炉状态
{
  "tool": "use_furnace",
  "arguments": {
    "action": "view"
  }
}

// 从熔炉取出产物
{
  "tool": "use_furnace",
  "arguments": {
    "action": "take",
    "items": [
      {"position": "output"}
    ]
  }
}

// 跟随玩家
{
  "tool": "follow_player",
  "arguments": {
    "player": "Steve",
    "distance": 5,
    "timeout": 30
  }
}

// 生成第一人称截图
{
  "tool": "screenshot",
  "arguments": {}
}
```

## MCP 工具

### 查询工具

- `query_state` - 查询游戏状态
- `query_events` - 查询事件历史

### 动作工具

动作工具会根据 `src/actions/` 目录中的动作文件自动生成，工具名格式为动作名的 snake_case 形式。例如：

- `MineBlockAction` → `mine_block` 工具
- `PlaceBlockAction` → `place_block` 工具
- `FollowPlayerAction` → `follow_player` 工具

每个动作工具都会自动包含：

- 基于 Zod schema 的参数校验
- 完整的参数类型说明
- 自动生成的工具描述
- 统一的错误处理和返回格式

## 开发

### 依赖要求

- Node.js >= 18.0.0
- pnpm >= 10.6.5
- Python (用于编译某些依赖)

### 主要依赖版本

- mineflayer: ^4.32.0
- @modelcontextprotocol/sdk: ^1.17.2
- mineflayer-pathfinder-mai: ^2.4.6
- prismarine-viewer: ^1.33.0
- canvas: ^3.1.2

```bash
# 构建
pnpm build

# 测试
pnpm test

# 代码检查
pnpm lint

# 清理构建文件
pnpm clean
```

## 许可证

MIT