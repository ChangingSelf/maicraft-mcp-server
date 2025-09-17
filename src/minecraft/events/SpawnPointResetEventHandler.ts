import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 重生点重置事件处理器
 * 处理重生点重置的事件
 */
export class SpawnPointResetEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('spawnReset', () => {
      if (!this.isEventDisabled(GameEventType.SPAWN_POINT_RESET)) {
        this.addEvent(this.createEvent('spawnReset', {
          position: {
            x: this.bot!.entity.position.x,
            y: this.bot!.entity.position.y,
            z: this.bot!.entity.position.z
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.SPAWN_POINT_RESET;
  }
}
