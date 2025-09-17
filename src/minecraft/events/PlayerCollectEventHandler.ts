import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { Logger } from '../../utils/Logger.js';

/**
 * 玩家收集物品事件处理器
 * 处理玩家收集物品的事件
 */
export class PlayerCollectEventHandler extends BaseEventHandler {
  private logger: Logger;

  constructor(
    bot: any,
    isEventDisabled: (eventType: GameEventType) => boolean,
    addEvent: (event: any) => void,
    getCurrentGameTick: () => number,
    getCurrentTimestamp: () => number
  ) {
    super(bot, isEventDisabled, addEvent, getCurrentGameTick, getCurrentTimestamp);
    this.logger = new Logger('PlayerCollectEventHandler');
  }

  register(): void {
    this.bot.on('playerCollect', (collector: any, collected: any) => {
      if (!this.isEventDisabled(GameEventType.PLAYER_COLLECT)) {
        // 检查是否是机器人自己收集的物品
        const isSelfCollect = collector.id === this.bot!.entity.id;

        const mcData = this.bot!.registry;

        const collectedItems = collected.metadata.filter((item: any) => item !== null)
          .map((item: any) => {
            return {
              count: item.itemCount,
              ...mcData.items[item.itemId],
            };
          });

        this.addEvent(this.createEvent('playerCollect', {
          collector: {
            id: collector.id,
            type: collector.type,
            name: collector.name,
            username: collector.username,
            position: {
              x: Number(collector.position.x?.toFixed(2) ?? 0),
              y: Number(collector.position.y?.toFixed(2) ?? 0),
              z: Number(collector.position.z?.toFixed(2) ?? 0)
            },
          },
          collected: collectedItems
        }));

        // 如果是机器人自己收集的物品，记录到日志
        if (isSelfCollect) {
          const itemNames = collectedItems.map((item: any) => item.name).join(', ');
          const itemCounts = collectedItems.map((item: any) => item.count).join(', ');
          this.logger.info(`机器人收集了物品: ${itemNames} x${itemCounts}`);
        }
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.PLAYER_COLLECT;
  }
}
