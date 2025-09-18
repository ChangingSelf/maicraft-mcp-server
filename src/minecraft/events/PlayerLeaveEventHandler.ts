import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 玩家离开事件处理器
 * 处理玩家离开服务器的事件
 */
export class PlayerLeaveEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('playerLeft', (entity: any) => {
      if (!this.isEventDisabled(GameEventType.PLAYER_LEAVE)) {
        this.addEvent(this.createEvent('playerLeft', {
          data: {
            uuid: entity.uuid,
            username: entity.username,
            displayName: entity.displayName?.toString(),
            ping: entity.ping,
            gamemode: entity.gamemode
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.PLAYER_LEAVE;
  }
}
