import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

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

  async execute(bot: Bot, params: MineBlockParams): Promise<ActionResult> {
    try {
      this.logger.info(`开始挖掘方块: ${params.name}, 数量: ${params.count ?? 1}`);
      
      const mcData = bot.registry;
      const blockByName = mcData.blocksByName[params.name];

      if (!blockByName) {
        this.logger.error(`未找到名为 ${params.name} 的方块`);
        return this.createErrorResult(`未找到名为 ${params.name} 的方块`, 'BLOCK_NOT_FOUND');
      }
      this.logger.info(`${blockByName}`)

      const count = params.count ?? 1;

      // 搜索附近目标方块
      for (let i = 0; i < count; i++) {
        const block = bot.findBlock({
            matching: [blockByName.id],
            maxDistance: 48,
          });
        if (!block) {
          this.logger.warn(`已挖掘 ${i} 个 ${params.name} 方块，附近未找到第 ${i+1} 个，请先探索其他区域`);
          return this.createErrorResult(`已挖掘 ${i} 个 ${params.name} 方块，附近未找到第 ${i+1} 个，请先探索其他区域`, 'NO_BLOCK_NEARBY');
        }
        this.logger.info(`找到第 ${i+1} 个 ${params.name} 方块`);

        await bot.collectBlock.collect(block, { ignoreNoPath: false });//原版collectBlock插件存在问题
        // await bot.tool.equipForBlock(block, {
        //   requireHarvest: true,//如果没有合适的工具，则抛出异常
        //   getFromChest: true,//允许从箱子中获取工具
        //   maxTools: 10,//最多从箱子中获取的工具数量
        // });
        // await bot.dig(block);
      }

      // 成功完成挖掘
      return this.createSuccessResult(`成功挖掘了 ${count} 个 ${params.name} 方块`, { 
        minedCount: count,
        blockName: params.name 
      });
    } catch (err) {
      this.logger.error(`挖掘 ${params.name} 失败: ${err instanceof Error ? err.message : String(err)}`);
      return this.createExceptionResult(err, `挖掘 ${params.name} 失败`, 'MINE_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露为 tool: mine_block
}