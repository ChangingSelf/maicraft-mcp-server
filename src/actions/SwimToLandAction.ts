import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { MovementUtils } from '../utils/MovementUtils.js';
import pathfinder from 'mineflayer-pathfinder';

interface SwimToLandParams extends BaseActionParams {
  /** 最大搜索半径，默认 64 */
  maxDistance?: number;
  /** 超时时间 (秒)，默认 60 */
  timeout?: number;
}

/**
 * SwimToLandAction - 当机器人在水中时，寻找最近陆地并游过去。
 * 为避免复杂扫描，采取简化策略：
 * 1. 使用 `bot.findBlocks` 搜索附近非水固体方块且上方为空气。
 * 2. 按距离排序逐个尝试前往；到达并检测不在水中即成功。
 */
export class SwimToLandAction extends BaseAction<SwimToLandParams> {
  name = 'swimToLand';
  description = '游向最近的陆地';
  schema = z.object({
    maxDistance: z.number().int().positive().optional().describe('最大搜索距离 (数字，可选，默认 64)'),
    timeout: z.number().int().positive().optional().describe('超时时间 (秒，可选，默认 60)'),
  });

  // 校验与参数描述由基类通过 schema 自动提供

  async execute(bot: Bot, params: SwimToLandParams): Promise<ActionResult> {
    try {
      const maxDist = params.maxDistance ?? 64;
      const timeoutSec = params.timeout ?? 60;

      if (bot.entity.onGround) {
        const block = bot.blockAt(bot.entity.position);
        if (block && block.name !== 'water') {
          return this.createSuccessResult('已在陆地上');
        }
      }

      // 检查移动工具类是否可用
      // MovementUtils 会自动检查 pathfinder

      const mcData = minecraftData(bot.version);
      const waterId = mcData.blocksByName.water.id;

      // 搜索可站立方块
      const positions = bot.findBlocks({
        maxDistance: maxDist,
        count: 200,
        matching: (block) => {
          if (!block) return false;
          if (block.type === waterId) return false;
          // 需要实体可站立
          const above = bot.blockAt(block.position.offset(0, 1, 0));
          const above2 = bot.blockAt(block.position.offset(0, 2, 0));
          return above?.name === 'air' && above2?.name === 'air';
        }
      });

      if (positions.length === 0) {
        return this.createErrorResult('未找到附近陆地', 'LAND_NOT_FOUND');
      }

      // 按距离排序
      positions.sort((a, b) => bot.entity.position.distanceTo(a) - bot.entity.position.distanceTo(b));

      const startTime = Date.now();
      for (const pos of positions) {
        // 使用统一的移动工具类移动到陆地位置
        const moveResult = await MovementUtils.moveToCoordinate(bot, pos.x, pos.y + 1, pos.z, 1, maxDist, false);

        if (!moveResult.success) {
          // 无法到达这个位置，继续尝试下一个
          continue;
        }

        // 检查是否离开水面
        if (bot.entity.onGround) {
          const blk = bot.blockAt(bot.entity.position);
          if (blk && blk.name !== 'water') {
            return this.createSuccessResult('已到达陆地');
          }
        }

        if ((Date.now() - startTime) / 1000 > timeoutSec) {
          break;
        }
      }

      return this.createErrorResult('超时未能到达陆地', 'TIMEOUT');
    } catch (err) {
      return this.createExceptionResult(err, '游向陆地失败', 'SWIM_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: swim_to_land）
} 