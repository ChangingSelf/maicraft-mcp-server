import { GameEvent, GameEventType } from '../GameEvent.js';
import { Bot } from 'mineflayer';

/**
 * 事件处理器基类
 * 定义了所有事件处理器的通用接口和行为
 */
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

  /**
   * 注册事件监听器
   * 子类必须实现此方法来注册具体的 mineflayer 事件监听器
   */
  abstract register(): void;

  /**
   * 获取该处理器对应的事件类型
   * 用于黑名单判断和处理器管理
   */
  abstract getEventType(): GameEventType;

  /**
   * 创建通用事件对象
   * 提供给子类使用的辅助方法
   */
  protected createEvent(type: string, data?: any): GameEvent {
    return {
      type,
      gameTick: this.getCurrentGameTick(),
      timestamp: this.getCurrentTimestamp(),
      ...data
    };
  }
}
