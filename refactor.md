# 事件管理器重构方案

## 🎯 重构目标

将事件注册职责从 EventManager 中分离出来，使用职责分离模式提高代码可维护性。

### 现状问题
- EventManager 中包含大量重复的事件注册代码
- 每个事件都有类似的注册逻辑和黑名单判断
- 代码冗长，难以维护和扩展
- 事件处理逻辑与管理逻辑耦合

### 重构后优势
- 每个事件处理器职责单一，易于维护
- 减少重复代码，提高代码复用性
- 便于添加新事件类型
- 提高代码可读性和可测试性

## 📋 重构方案

### 1. 创建事件处理器架构

#### 1.1 基类设计
```typescript
// src/minecraft/events/BaseEventHandler.ts
export abstract class BaseEventHandler {
  protected bot: Bot;
  protected isEventDisabled: (eventType: GameEventType) => boolean;
  protected addEvent: (event: GameEvent) => void;
  protected getCurrentGameTick: () => number;
  protected getCurrentTimestamp: () => number;

  constructor(
    bot: Bot,
    isEventDisabled: (eventType: GameEventType) => boolean,
    addEvent: (event: GameEvent) => void,
    getCurrentGameTick: () => number,
    getCurrentTimestamp: () => number
  ) {
    this.bot = bot;
    this.isEventDisabled = isEventDisabled;
    this.addEvent = addEvent;
    this.getCurrentGameTick = getCurrentGameTick;
    this.getCurrentTimestamp = getCurrentTimestamp;
  }

  // 抽象方法：注册事件监听器
  abstract register(): void;

  // 抽象方法：获取事件类型
  abstract getEventType(): GameEventType;

  // 受保护方法：创建通用事件对象
  protected createEvent(type: string, data: any): GameEvent {
    return {
      type,
      gameTick: this.getCurrentGameTick(),
      timestamp: this.getCurrentTimestamp(),
      ...data
    };
  }
}
```

#### 1.2 具体处理器类

**ChatEventHandler** (特殊处理)
```typescript
// src/minecraft/events/ChatEventHandler.ts
export class ChatEventHandler extends BaseEventHandler {
  private debugCommandHandler?: DebugCommandHandler;
  private chatFilterManager?: ChatFilterManager;

  constructor(...) {
    super(...);
    // 需要注入调试命令处理器和聊天过滤管理器
  }

  register(): void {
    this.bot.on('chat', async (username, message, translate, jsonMsg, matches) => {
      // 处理调试命令
      if (this.debugCommandHandler) {
        const isHandled = await this.debugCommandHandler.handleChatMessage(username, message);
        if (isHandled) return;
      }

      // 处理聊天过滤
      if (this.chatFilterManager?.shouldFilterMessage(username, message)) {
        return;
      }

      // 创建事件
      if (!this.isEventDisabled(GameEventType.CHAT)) {
        this.addEvent(this.createEvent('chat', {
          chatInfo: { text: message, username }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.CHAT;
  }
}
```

**PlayerJoinEventHandler**
```typescript
// src/minecraft/events/PlayerJoinEventHandler.ts
export class PlayerJoinEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('playerJoined', (player) => {
      if (!this.isEventDisabled(GameEventType.PLAYER_JOIN)) {
        this.addEvent(this.createEvent('playerJoined', {
          playerInfo: {
            uuid: player.uuid,
            username: player.username,
            displayName: player.displayName?.toString(),
            ping: player.ping,
            gamemode: player.gamemode
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.PLAYER_JOIN;
  }
}
```

**其他处理器类**：
- PlayerLeaveEventHandler
- PlayerDeathEventHandler
- PlayerRespawnEventHandler
- WeatherChangeEventHandler
- PlayerKickEventHandler
- SpawnPointResetEventHandler
- HealthUpdateEventHandler
- EntityHurtEventHandler
- EntityDeathEventHandler
- PlayerCollectEventHandler

#### 1.3 处理器发现机制
```typescript
// src/minecraft/events/index.ts
import { ChatEventHandler } from './ChatEventHandler.js';
import { PlayerJoinEventHandler } from './PlayerJoinEventHandler.js';
// ... 其他导入

export function getAllEventHandlers(): (new (
  bot: Bot,
  isEventDisabled: (eventType: GameEventType) => boolean,
  addEvent: (event: GameEvent) => void,
  getCurrentGameTick: () => number,
  getCurrentTimestamp: () => number
) => BaseEventHandler)[] {
  return [
    ChatEventHandler,
    PlayerJoinEventHandler,
    PlayerLeaveEventHandler,
    // ... 其他处理器类
  ];
}
```

### 2. 修改 EventManager

#### 2.1 添加处理器管理
```typescript
export class EventManager {
  private eventHandlers: BaseEventHandler[] = [];

  // ... 现有代码 ...

  private initializeEventHandlers(): void {
    if (!this.bot) return;

    const handlerClasses = getAllEventHandlers();
    this.eventHandlers = [];

    for (const HandlerClass of handlerClasses) {
      // 特殊处理 ChatEventHandler，需要注入额外的依赖
      if (HandlerClass === ChatEventHandler) {
        const handler = new HandlerClass(
          this.bot,
          this.isEventDisabled.bind(this),
          this.addEvent.bind(this),
          this.getCurrentGameTick.bind(this),
          this.getCurrentTimestamp.bind(this),
          this.debugCommandHandler,  // 额外依赖
          this.chatFilterManager     // 额外依赖
        );
        this.eventHandlers.push(handler);
      } else {
        const handler = new HandlerClass(
          this.bot,
          this.isEventDisabled.bind(this),
          this.addEvent.bind(this),
          this.getCurrentGameTick.bind(this),
          this.getCurrentTimestamp.bind(this)
        );
        this.eventHandlers.push(handler);
      }
    }

    this.logger.info(`已初始化 ${this.eventHandlers.length} 个事件处理器`);
  }

  private setupEventListeners(): void {
    if (!this.bot) return;

    // 注册所有事件处理器
    for (const handler of this.eventHandlers) {
      handler.register();
    }

    this.logger.info(`已注册 ${this.eventHandlers.length} 个事件监听器`);
  }
}
```

#### 2.2 修改 registerBot 方法
```typescript
async registerBot(bot: Bot, debugCommandsConfig?: DebugCommandsConfig): Promise<void> {
  this.bot = bot;

  // ... 现有调试命令处理代码 ...

  this.initializeEventHandlers();
  this.setupEventListeners();
  this.logger.info('已注册 mineflayer bot 并设置事件监听器');
}
```

### 3. 迁移步骤

#### 阶段一：创建基础架构
1. 创建 `BaseEventHandler` 基类
2. 创建 `ChatEventHandler` (特殊处理)
3. 创建 `PlayerJoinEventHandler` 和 `PlayerLeaveEventHandler`
4. 修改 EventManager 集成新的架构

#### 阶段二：逐步迁移
1. 迁移简单的事件处理器 (PlayerDeath, PlayerRespawn, WeatherChange 等)
2. 迁移复杂的事件处理器 (EntityHurt, EntityDeath, PlayerCollect 等)
3. 移除 EventManager 中的旧注册代码

#### 阶段三：清理和优化
1. 移除所有旧的事件注册代码
2. 添加单元测试
3. 更新文档

### 4. 文件结构

```
src/minecraft/events/
├── index.ts                    # 导出所有处理器
├── BaseEventHandler.ts        # 基类
├── ChatEventHandler.ts        # 聊天事件 (特殊处理)
├── PlayerJoinEventHandler.ts  # 玩家加入
├── PlayerLeaveEventHandler.ts # 玩家离开
├── PlayerDeathEventHandler.ts # 玩家死亡
├── PlayerRespawnEventHandler.ts # 玩家重生
├── WeatherChangeEventHandler.ts # 天气变化
├── PlayerKickEventHandler.ts  # 玩家被踢出
├── SpawnPointResetEventHandler.ts # 重生点重置
├── HealthUpdateEventHandler.ts # 生命值更新
├── EntityHurtEventHandler.ts  # 实体受伤
├── EntityDeathEventHandler.ts # 实体死亡
└── PlayerCollectEventHandler.ts # 玩家收集物品
```

### 5. 优势分析

#### 代码质量提升
- **单一职责**：每个处理器只负责一个事件
- **可维护性**：修改某个事件只需改一个文件
- **可测试性**：每个处理器都可以独立测试
- **可扩展性**：添加新事件只需创建新类

#### 减少重复代码
- **通用逻辑提取**：黑名单判断、事件创建等逻辑统一处理
- **模板方法模式**：基类定义算法框架，子类实现具体步骤
- **依赖注入**：减少耦合，提高灵活性

#### 架构优化
- **职责分离**：管理逻辑与处理逻辑分离
- **接口一致性**：所有处理器实现相同的接口
- **运行时发现**：自动发现和注册处理器

### 6. 风险评估

#### 潜在风险
1. **性能影响**：动态创建处理器对象
2. **依赖管理**：ChatEventHandler 需要特殊处理
3. **向后兼容**：确保现有功能不受影响

#### 缓解措施
1. **延迟初始化**：只在需要时创建处理器
2. **依赖注入**：清晰的依赖关系管理
3. **逐步迁移**：分阶段实施，降低风险

### 7. 实施计划

#### Week 1: 基础架构搭建
- [ ] 创建 BaseEventHandler 基类
- [ ] 创建 index.ts 导出文件
- [ ] 创建 ChatEventHandler
- [ ] 修改 EventManager 集成新架构

#### Week 2: 核心事件迁移
- [ ] 创建 PlayerJoinEventHandler, PlayerLeaveEventHandler
- [ ] 创建 PlayerDeathEventHandler, PlayerRespawnEventHandler
- [ ] 创建 WeatherChangeEventHandler, PlayerKickEventHandler

#### Week 3: 复杂事件迁移
- [ ] 创建 SpawnPointResetEventHandler, HealthUpdateEventHandler
- [ ] 创建 EntityHurtEventHandler, EntityDeathEventHandler
- [ ] 创建 PlayerCollectEventHandler

#### Week 4: 测试和优化
- [ ] 编写单元测试
- [ ] 性能测试和优化
- [ ] 清理旧代码
- [ ] 更新文档

## 🎯 总结

这个重构方案将显著提高代码的可维护性和可扩展性。通过将事件处理职责分离到独立的处理器类中，我们可以：

1. **减少代码重复**：将通用逻辑提取到基类
2. **提高可维护性**：每个事件处理器职责单一
3. **增强可扩展性**：添加新事件只需创建新类
4. **改善可测试性**：每个处理器都可以独立测试

重构将按照渐进式策略进行，确保系统的稳定性和向后兼容性。
