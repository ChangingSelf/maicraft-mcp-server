import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

interface MineBlockParams extends BaseActionParams {
  /** 方块名称，例如 "dirt" */
  name: string;
  /** 需要挖掘的数量，默认 1 */
  count?: number;
  /** 是否绕过所有检查，直接挖掘 */
  bypassAllCheck?: boolean;
}

interface DirectMineBlockParams extends BaseActionParams {
  /** 方块名称，例如 "dirt" */
  name: string;
  /** 需要挖掘的数量，默认 1 */
  count?: number;
}

/**
 * MineBlockAction - 按名称在附近寻找并挖掘若干方块。
 * 逻辑主要参照 MineLand 的 high_level_action/mineBlock.js。
 * 
 * 安全机制说明：
 * - 默认使用collectBlock插件进行挖掘，包含安全检查
 * - 当遇到"Block is not safe to break!"错误时，可能的原因：
 *   1. 方块上方有会掉落的方块（如沙子、沙砾）
 *   2. 方块上方有实体
 *   3. 方块周围有液体
 * - 可以通过bypassSafetyCheck参数绕过安全检查
 * - 可以通过autoFallback参数在安全检查失败时自动尝试直接挖掘
 */
export class MineBlockAction extends BaseAction<MineBlockParams> {
  name = 'mineBlock';
  description = '挖掘指定类型的方块（按名称）';
  schema = z.object({
    name: z.string().describe('方块名称 (字符串)'),
    count: z.number().int().min(1).optional().describe('挖掘数量 (数字，可选，默认 1)'),
    bypassAllCheck: z.boolean().optional().describe('是否绕过所有检查，直接挖掘，默认false'),
  });

  // 校验和 schema 描述由基类提供

  async execute(bot: Bot, params: MineBlockParams): Promise<ActionResult> {
    try {
      const count = params.count ?? 1;
      const bypassAllCheck = params.bypassAllCheck ?? false;
      
      this.logger.info(`开始挖掘方块: ${params.name}, 数量: ${count}, 绕过所有检查: ${bypassAllCheck}`);
      
      const mcData = bot.registry;
      const blockByName = mcData.blocksByName[params.name];

      if (!blockByName) {
        this.logger.error(`未找到名为 ${params.name} 的方块`);
        return this.createErrorResult(`未找到名为 ${params.name} 的方块`, 'BLOCK_NOT_FOUND');
      }
      this.logger.info(`找到方块定义: ${blockByName.name} (ID: ${blockByName.id})`);

      let successCount = 0;
      let fallbackCount = 0;

      // 搜索附近目标方块
      for (let i = 0; i < count; i++) {
        const block = bot.findBlock({
            matching: [blockByName.id],
            maxDistance: 48,
          });
        if (!block) {
          this.logger.warn(`已挖掘 ${successCount} 个 ${params.name} 方块，附近未找到第 ${i+1} 个，请先探索其他区域`);
          return this.createErrorResult(`已挖掘 ${successCount} 个 ${params.name} 方块，附近未找到第 ${i+1} 个，请先探索其他区域`, 'NO_BLOCK_NEARBY');
        }
        this.logger.info(`找到第 ${i+1} 个 ${params.name} 方块，位置: ${block.position.x}, ${block.position.y}, ${block.position.z}`);

        let blockMined = false;
        
        if (bypassAllCheck) {
          // 绕过安全检查，直接使用bot.dig()
          this.logger.info(`绕过安全检查，直接挖掘方块`);
          await this.digBlockDirectly(bot, block);
          blockMined = true;
        } else {
          // 使用collectBlock插件（包含安全检查）
          try {
            await bot.collectBlock.collect(block, { ignoreNoPath: false });
            blockMined = true;
          } catch (collectError) {
            throw collectError;
          }
        }
        
        if (blockMined) {
          successCount++;
          this.logger.info(`成功挖掘第 ${i+1} 个 ${params.name} 方块`);
        }
      }

      // 成功完成挖掘
      const resultMessage = `成功挖掘了 ${successCount} 个 ${params.name} 方块`;
      const resultData = { 
        minedCount: successCount,
        blockName: params.name,
        fallbackCount: fallbackCount
      };
      
      if (fallbackCount > 0) {
        this.logger.info(`${resultMessage}（其中 ${fallbackCount} 个使用了直接挖掘绕过安全检查）`);
      }
      
      return this.createSuccessResult(resultMessage, resultData);
    } catch (err) {
      this.logger.error(`挖掘 ${params.name} 失败: ${err instanceof Error ? err.message : String(err)}`);
      return this.createExceptionResult(err, `挖掘 ${params.name} 失败`, 'MINE_FAILED');
    }
  }

  /**
   * 直接挖掘方块，绕过安全检查
   */
  private async digBlockDirectly(bot: Bot, block: any): Promise<void> {
    // 装备合适的工具
    await bot.tool.equipForBlock(block);
    
    // 直接挖掘
    await bot.dig(block);
  }

  // MCP 工具由基类根据 schema 自动暴露为 tool: mine_block
}