import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

interface QueryGameStateParams extends BaseActionParams {
  includeWeather?: boolean;
  includeTime?: boolean;
  includeDimension?: boolean;
  includeWorldInfo?: boolean;
}

export class QueryGameStateAction extends BaseAction<QueryGameStateParams> {
  name = 'queryGameState';
  description = '查询游戏状态信息，包括天气、时间、维度等';
  schema = z.object({
    includeWeather: z.boolean().optional().describe('是否包含天气信息'),
    includeTime: z.boolean().optional().describe('是否包含时间信息'),
    includeDimension: z.boolean().optional().describe('是否包含维度信息'),
    includeWorldInfo: z.boolean().optional().describe('是否包含世界信息'),
  });

  async execute(bot: Bot, params: QueryGameStateParams): Promise<ActionResult> {
    try {
      this.logger.info('查询游戏状态信息');
      
      const result: any = {};

      // 根据参数决定包含哪些信息
      if (params.includeWeather !== false) {
        let weather: string;
        if (bot.thunderState > 0) {
          weather = 'thunder';
        } else if (bot.isRaining) {
          weather = 'rain';
        } else {
          weather = 'clear';
        }
        
        result.weather = {
          current: weather,
          isRaining: bot.isRaining,
          thunderState: bot.thunderState
        };
      }

      if (params.includeTime !== false) {
        const timeOfDay = bot.time.timeOfDay;
        // 注意：worldAge 可能在新版本中不可用
        const worldAge = (bot.time as any).worldAge || 0;
        
        // 计算游戏内时间
        const hours = Math.floor((timeOfDay + 6000) / 1000) % 24;
        const minutes = Math.floor(((timeOfDay + 6000) % 1000) / 1000 * 60);
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        result.time = {
          timeOfDay,
          worldAge,
          timeString,
          isDay: timeOfDay >= 0 && timeOfDay < 12000,
          isNight: timeOfDay >= 12000 && timeOfDay < 24000
        };
      }

      if (params.includeDimension !== false) {
        result.dimension = {
          name: bot.game.dimension || 'overworld',
          difficulty: bot.game.difficulty,
          gameMode: bot.game.gameMode,
          hardcore: bot.game.hardcore
        };
      }

      if (params.includeWorldInfo !== false) {
        result.world = {
          levelType: bot.game.levelType,
          // 注意：以下属性可能在新版本中不可用
          worldType: (bot.game as any).worldType || 'default',
          reducedDebugInfo: (bot.game as any).reducedDebugInfo || false,
          viewDistance: (bot.game as any).viewDistance || 10
        };
      }

      this.logger.info('成功查询游戏状态信息');
      return this.createSuccessResult('成功查询游戏状态信息', result);
    } catch (error) {
      this.logger.error(`查询游戏状态失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询游戏状态失败', 'QUERY_GAME_STATE_FAILED');
    }
  }
}
