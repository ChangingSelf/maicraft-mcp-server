# 调试命令系统

这个目录包含了 Maicraft 的调试命令系统实现。系统支持自动发现和注册命令，类似于动作系统的设计。

## 目录结构

```
src/commands/
├── BaseCommand.ts      # 调试命令基类
├── ChatCommand.ts      # 聊天命令实现
├── HelpCommand.ts      # 帮助命令实现
├── TestCommand.ts      # 测试命令实现
└── README.md          # 本文档
```

## 创建新命令

要创建新的调试命令，请按照以下步骤：

### 1. 创建命令类

继承 `BaseCommand` 类并实现必要的方法：

```typescript
import { Bot } from 'mineflayer';
import { BaseCommand, CommandResult } from './BaseCommand.js';

export class MyCommand extends BaseCommand {
  name = 'mycommand';                    // 命令名称（不含!前缀）
  description = '我的命令描述';          // 命令描述
  usage = '!mycommand <参数>';           // 使用说明（可选）

  async execute(bot: Bot, username: string, args: string[]): Promise<CommandResult> {
    // 实现命令逻辑
    // 返回成功或失败的结果

    // 成功示例
    return this.success('命令执行成功');

    // 失败示例
    return this.error('命令执行失败');
  }
}

// 导出命令实例
export const myCommand = new MyCommand();
```

### 2. 命令方法说明

#### `execute(bot, username, args)`
- `bot`: Mineflayer Bot 实例
- `username`: 执行命令的玩家用户名
- `args`: 命令参数数组
- 返回: `CommandResult` 对象

#### `parseArgs(args)`
基类提供的方法，用于解析命令参数：
- 位置参数: `arg0`, `arg1`, ...
- 命名参数: `--param value` 或 `--flag`

#### 结果方法
- `this.success(message?, data?)`: 返回成功结果
- `this.error(message)`: 返回失败结果

### 3. 内置命令

#### ChatCommand (`!chat`)
让bot发送指定消息
```
!chat 你好，世界！
```

#### HelpCommand (`!help`)
显示所有可用命令的帮助信息
```
!help          # 显示所有命令
!help chat     # 显示特定命令的帮助
```

#### TestCommand (`!test`)
测试命令系统功能
```
!test                    # 基本测试
!test --echo <消息>      # 回显消息
!test --info             # 显示bot信息
!test --help             # 显示帮助
```

## 配置

在 `config.yaml` 中配置调试命令系统：

```yaml
debugCommands:
  enabled: true              # 是否启用调试命令系统
  adminPlayers:              # 管理员玩家名单
    - "Player1"              # 管理员用户名
    - "Player2"
```

## 自动发现机制

系统会自动扫描以下目录来发现命令：
1. `src/commands/` (开发环境)
2. `dist/commands/` (生产环境)
3. `./src/commands/` (相对路径)
4. `./dist/commands/` (相对路径)

## 安全特性

- 只有配置文件中 `adminPlayers` 列表中的玩家才能使用调试命令
- 调试命令以 `!` 开头，与普通聊天消息区分
- 调试命令不会被记录到正常的事件历史中

## 示例：创建位置命令

```typescript
import { Bot } from 'mineflayer';
import { BaseCommand, CommandResult } from './BaseCommand.js';

export class PositionCommand extends BaseCommand {
  name = 'pos';
  description = '显示bot当前位置';
  usage = '!pos';

  async execute(bot: Bot, username: string, args: string[]): Promise<CommandResult> {
    const position = bot.entity.position;
    const dimension = bot.game.dimension;

    bot.chat(`[位置] 维度: ${dimension}`);
    bot.chat(`[位置] 坐标: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);

    return this.success('已显示当前位置');
  }
}

export const positionCommand = new PositionCommand();
```

这样就可以创建一个新的 `!pos` 命令来显示bot的位置了！
