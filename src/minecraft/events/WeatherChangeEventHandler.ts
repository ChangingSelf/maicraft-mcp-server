import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 天气变化事件处理器
 * 处理天气变化的事件
 */
export class WeatherChangeEventHandler extends BaseEventHandler {
  register(): void {
    // 监听天气变化事件
    // 注意：根据 mineflayer API 文档，'rain' 事件在天气开始或停止下雨时触发
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
