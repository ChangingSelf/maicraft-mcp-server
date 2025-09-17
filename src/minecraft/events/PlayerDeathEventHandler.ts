import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 玩家死亡事件处理器
 * 处理玩家死亡的事件
 */
export class PlayerDeathEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('death', () => {
      if (!this.isEventDisabled(GameEventType.PLAYER_DEATH)) {
        this.addEvent(this.createEvent('death', {
          player: {
            uuid: this.bot!.player.uuid,
            username: this.bot!.player.username,
            displayName: this.bot!.player.displayName?.toString(),
            ping: this.bot!.player.ping,
            gamemode: this.bot!.player.gamemode
          }
          // 根据 mineflayer API 文档，death 事件不提供死亡消息参数
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.PLAYER_DEATH;
  }
}
