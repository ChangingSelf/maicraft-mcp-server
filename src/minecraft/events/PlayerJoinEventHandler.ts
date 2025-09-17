import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 玩家加入事件处理器
 * 处理玩家加入服务器的事件
 */
export class PlayerJoinEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('playerJoined', (player: any) => {
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
