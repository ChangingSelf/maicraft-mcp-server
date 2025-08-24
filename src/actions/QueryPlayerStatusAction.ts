import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

interface QueryPlayerStatusParams extends BaseActionParams {
  includePosition?: boolean;
  includeHealth?: boolean;
  includeExperience?: boolean;
  includeFood?: boolean;
  includeInventory?: boolean;
}

export class QueryPlayerStatusAction extends BaseAction<QueryPlayerStatusParams> {
  name = 'queryPlayerStatus';
  description = '查询Bot自身的状态信息，包括位置、生命值、经验、食物等';
  schema = z.object({
    includePosition: z.boolean().optional().describe('是否包含位置信息'),
    includeHealth: z.boolean().optional().describe('是否包含生命值信息'),
    includeExperience: z.boolean().optional().describe('是否包含经验信息'),
    includeFood: z.boolean().optional().describe('是否包含食物信息'),
    includeInventory: z.boolean().optional().describe('是否包含背包信息'),
  });

  async execute(bot: Bot, params: QueryPlayerStatusParams): Promise<ActionResult> {
    try {
      this.logger.info('查询Bot自身状态信息');
      
      const result: any = {
        player: {
          uuid: bot.player.uuid,
          username: bot.player.username,
          displayName: bot.player.displayName?.toString(),
          ping: bot.player.ping,
          gamemode: bot.player.gamemode
        }
      };

      // 根据参数决定包含哪些信息
      if (params.includePosition !== false) {
        result.position = {
          x: bot.entity.position.x,
          y: bot.entity.position.y,
          z: bot.entity.position.z
        };
      }

      if (params.includeHealth !== false) {
        result.health = {
          current: bot.health,
          max: 20,
          percentage: (bot.health / 20) * 100
        };
      }

      if (params.includeExperience !== false) {
        result.experience = {
          points: bot.experience.points,
          level: bot.experience.level,
          progress: bot.experience.progress
        };
      }

      if (params.includeFood !== false) {
        result.food = {
          current: bot.food,
          max: 20,
          saturation: bot.foodSaturation,
          percentage: (bot.food / 20) * 100
        };
      }

      if (params.includeInventory !== false) {
        result.inventory = bot.inventory.items().map(item => ({
          type: item.type,
          count: item.count,
          name: item.name,
          displayName: item.displayName,
          slot: item.slot
        }));
      }

      this.logger.info('成功查询Bot状态信息');
      return this.createSuccessResult('成功查询Bot状态信息', result);
    } catch (error) {
      this.logger.error(`查询Bot状态失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询Bot状态失败', 'QUERY_PLAYER_STATUS_FAILED');
    }
  }
}
