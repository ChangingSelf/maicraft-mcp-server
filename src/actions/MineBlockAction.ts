import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams } from '../minecraft/ActionInterface';
import minecraftData from 'minecraft-data';

interface MineBlockParams extends BaseActionParams {
  /** 方块名称，例如 "dirt" */
  name: string;
  /** 需要挖掘的数量，默认 1 */
  count?: number;
}

/**
 * MineBlockAction - 按名称在附近寻找并挖掘若干方块。
 * 逻辑主要参照 MineLand 的 high_level_action/mineBlock.js。
 */
export class MineBlockAction extends BaseAction<MineBlockParams> {
  name = 'mineBlock';
  description = '挖掘指定类型的方块（按名称）';

  validateParams(params: MineBlockParams): boolean {
    return this.validateStringParams(params, ['name']) &&
           (typeof params.count === 'undefined' || typeof params.count === 'number');
  }

  getParamsSchema(): Record<string, string> {
    return {
      name: '方块名称 (字符串)',
      count: '挖掘数量 (数字，可选，默认 1)'
    };
  }

  async execute(bot: Bot, params: MineBlockParams): Promise<any> {
    try {
      const mcData = minecraftData(bot.version);
      const blockByName = mcData.blocksByName[params.name];

      if (!blockByName) {
        return this.createErrorResult(`未找到名为 ${params.name} 的方块`, 'BLOCK_NOT_FOUND');
      }

      const count = params.count ?? 1;

      // 搜索附近目标方块
      const positions = bot.findBlocks({
        matching: [blockByName.id],
        maxDistance: 48,
        count
      });

      if (positions.length === 0) {
        return this.createErrorResult(`附近未找到 ${params.name} 方块，请先探索其他区域`, 'NO_BLOCK_NEARBY');
      }

      // 收集目标 block 对象
      const targets = positions.map((pos) => bot.blockAt(pos)).filter(Boolean) as any[];

      // 优先使用 collectBlock 插件（若存在），否则逐个挖掘
      if (bot.collectBlock?.collect) {
        await bot.collectBlock.collect(targets, { ignoreNoPath: true });
      } else {
        for (const block of targets) {
          // 若没有 collectBlock 插件，则尝试移动到方块附近并直接挖掘
          if (bot.pathfinder?.goto) {
            const pathfinder = await import('mineflayer-pathfinder');
            const { GoalNear } = pathfinder.goals;
            const goal = new GoalNear(block.position.x, block.position.y, block.position.z, 1);
            await bot.pathfinder.goto(goal);
          }
          await bot.dig(block);
        }
      }

      return this.createSuccessResult(`已成功挖掘 ${targets.length} 个 ${params.name}`, { 
        name: params.name, 
        count: targets.length 
      });
    } catch (err) {
      return this.createExceptionResult(err, `挖掘 ${params.name} 失败`, 'MINE_FAILED');
    }
  }
} 