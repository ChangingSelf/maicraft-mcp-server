import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

export class QueryGameStateAction extends BaseAction<BaseActionParams> {
  name = 'queryGameState';
  description = '查询游戏状态信息，包括天气、时间、维度、世界信息、当前在线玩家等';
  schema = z.object({});

  async execute(bot: Bot, params: BaseActionParams): Promise<ActionResult> {
    try {
      this.logger.debug('查询游戏状态信息');
      
      // 天气信息
      let weather: string;
      if (bot.thunderState > 0) {
        weather = 'thunder';
      } else if (bot.isRaining) {
        weather = 'rain';
      } else {
        weather = 'clear';
      } 

      const result = {
        timeOfDay: bot.time.timeOfDay,
        timeOfDayString: this.getTimeOfDayString(bot.time.timeOfDay),
        worldAge: bot.time.age,
        dayOfWorld: bot.time.day,
        isDay: bot.time.isDay,
        dimension: bot.game.dimension,
        difficulty: bot.game.difficulty,
        gameMode: bot.game.gameMode,
        onlinePlayers: this.getSimplePlayerInfo(bot),
        weather,
      };

      this.logger.debug('成功查询游戏状态信息');
      return this.createSuccessResult('成功查询游戏状态信息', result);
    } catch (error) {
      this.logger.error(`查询游戏状态失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询游戏状态失败', 'QUERY_GAME_STATE_FAILED');
    }
  }
  getSimplePlayerInfo(bot: Bot) {
    //目前只返回玩家名字
    return Object.keys(bot.players);
  }

  private getTimeOfDayString(timeOfDay: number): string {
    // 将时间刻度转换为0-24000范围内的值
    const normalizedTime = timeOfDay % 24000;
    
    if (normalizedTime >= 0 && normalizedTime < 1000) {
      return 'sunrise';
    } else if (normalizedTime >= 1000 && normalizedTime < 6000) {
      return 'morning';
    } else if (normalizedTime >= 6000 && normalizedTime < 12000) {
      return 'noon';
    } else if (normalizedTime >= 12000 && normalizedTime < 13000) {
      return 'sunset';
    } else if (normalizedTime >= 13000 && normalizedTime < 18000) {
      return 'night';
    } else {
      return 'midnight';
    }
  }
}
