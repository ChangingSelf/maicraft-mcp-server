import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 天气变化事件处理器
 * 处理天气变化的事件
 */
export class WeatherChangeEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('rain', () => {
      if (!this.isEventDisabled(GameEventType.WEATHER_CHANGE)) {
        // 根据当前天气状态确定天气类型
        let weather: 'clear' | 'rain' | 'thunder';
        if (this.bot!.thunderState > 0) {
          weather = 'thunder';
        } else if (this.bot!.isRaining) {
          weather = 'rain';
        } else {
          weather = 'clear';
        }

        this.addEvent(this.createEvent('rain', {
          weather: weather
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.WEATHER_CHANGE;
  }
}
