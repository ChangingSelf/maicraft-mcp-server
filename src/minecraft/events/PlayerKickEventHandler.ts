import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 玩家踢出事件处理器
 * 处理玩家被服务器踢出的事件
 */
export class PlayerKickEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('kicked', (reason: string, loggedIn: boolean) => {
      if (!this.isEventDisabled(GameEventType.PLAYER_KICK)) {
        this.addEvent(this.createEvent('kicked', {
          player: {
            uuid: this.bot!.player.uuid,
            username: this.bot!.player.username,
            displayName: this.bot!.player.displayName?.toString(),
            ping: this.bot!.player.ping,
            gamemode: this.bot!.player.gamemode
          },
          reason: reason
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.PLAYER_KICK;
  }
}
