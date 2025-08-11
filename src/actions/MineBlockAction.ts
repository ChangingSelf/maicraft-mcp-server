import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams } from '../minecraft/ActionInterface.js';
import minecraftData from 'minecraft-data';
import { z } from 'zod';
import pathfinder from 'mineflayer-pathfinder';

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
  schema = z.object({
    name: z.string().describe('方块名称 (字符串)'),
    count: z.number().int().min(1).optional().describe('挖掘数量 (数字，可选，默认 1)'),
  });

  // 校验和 schema 描述由基类提供

  async execute(bot: Bot, params: MineBlockParams): Promise<any> {
    try {
      this.logger.info(`开始挖掘方块: ${params.name}, 数量: ${params.count ?? 1}`);
      
      const mcData = minecraftData(bot.version);
      const blockByName = mcData.blocksByName[params.name];

      if (!blockByName) {
        this.logger.error(`未找到名为 ${params.name} 的方块`);
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
        this.logger.warn(`附近未找到 ${params.name} 方块，请先探索其他区域`);
        return this.createErrorResult(`附近未找到 ${params.name} 方块，请先探索其他区域`, 'NO_BLOCK_NEARBY');
      }

      // 收集目标 block 对象
      const targets = positions.map((pos) => bot.blockAt(pos)).filter(Boolean) as any[];

      // 优先使用 collectBlock 插件（若存在），否则逐个挖掘
      if (bot.collectBlock?.collect) {
        this.logger.debug(`使用 collectBlock 插件挖掘 ${targets.length} 个方块`);
        await bot.collectBlock.collect(targets, { ignoreNoPath: true });
      } else {
        this.logger.debug(`逐个挖掘 ${targets.length} 个方块`);
        for (const block of targets) {
          // 若没有 collectBlock 插件，则尝试移动到方块附近并直接挖掘
          if (bot.pathfinder?.goto) {
            const { GoalNear } = pathfinder.goals;
            if (!GoalNear) {
              return this.createErrorResult('mineflayer-pathfinder goals 未加载', 'PATHFINDER_NOT_LOADED');
            }
            const goal = new GoalNear(block.position.x, block.position.y, block.position.z, 1);
            await bot.pathfinder.goto(goal);
          }
          await bot.dig(block);
        }
      }

      this.logger.info(`成功挖掘 ${targets.length} 个 ${params.name}`);
      return this.createSuccessResult(`已成功挖掘 ${targets.length} 个 ${params.name}`, { 
        name: params.name, 
        count: targets.length 
      });
    } catch (err) {
      this.logger.error(`挖掘 ${params.name} 失败: ${err instanceof Error ? err.message : String(err)}`);
      return this.createExceptionResult(err, `挖掘 ${params.name} 失败`, 'MINE_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露为 tool: mine_block
}