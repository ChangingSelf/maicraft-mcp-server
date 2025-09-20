import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { Logger } from '../../utils/Logger.js';
import { Entity } from 'prismarine-entity';

/**
 * 物品丢弃事件处理器
 * 处理实体丢弃物品的事件
 */
export class ItemDropEventHandler extends BaseEventHandler {
  private logger: Logger;

  constructor(
    bot: any,
    isEventDisabled: (eventType: GameEventType) => boolean,
    addEvent: (event: any) => void,
    getCurrentGameTick: () => number,
    getCurrentTimestamp: () => number
  ) {
    super(bot, isEventDisabled, addEvent, getCurrentGameTick, getCurrentTimestamp);
    this.logger = new Logger('ItemDropEventHandler');
  }

  register(): void {
    this.bot.on('itemDrop', (entity: Entity) => {
      if (!this.isEventDisabled(GameEventType.ITEM_DROP)) {
        const mcData = this.bot!.registry;

        // 从 entity.metadata 中提取物品信息
        const droppedItems = entity.metadata.filter((item: any) => item !== null && item.itemId !== undefined)
          .map((item: any) => {
            return {
              id: item.itemId,
              name: mcData.items[item.itemId]?.name || 'unknown',
              displayName: mcData.items[item.itemId]?.displayName || 'unknown',
              count: item.itemCount,
              metadata: item.metadata
            };
          });

        this.addEvent(this.createEvent('itemDrop', {
          data: {
            dropped: droppedItems,
            position: {
              x: Number(entity.position.x.toFixed(2)),
              y: Number(entity.position.y.toFixed(2)),
              z: Number(entity.position.z.toFixed(2))
            }
          }
        }));

        // 记录物品丢弃信息到日志
        const itemNames = droppedItems.map((item: any) => item.name).join(', ');
        const itemCounts = droppedItems.map((item: any) => item.count).join(', ');
        this.logger.info(`物品被丢弃: ${itemNames} x${itemCounts}`);
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.ITEM_DROP;
  }
}
