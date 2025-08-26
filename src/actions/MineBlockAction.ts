import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Vec3 } from 'vec3';

interface MineBlockParams extends BaseActionParams {
  /** 方块名称，例如 "dirt" */
  name: string;
  /** 需要挖掘的数量，默认 1 */
  count?: number;
  /** 是否绕过所有检查，直接挖掘 */
  bypassAllCheck?: boolean;
  /** 挖掘方向，可选值：up, down, north, south, east, west。不指定时在附近搜索 */
  direction?: 'up' | 'down' | 'north' | 'south' | 'east' | 'west';
  /** 搜索距离，默认 48 */
  maxDistance?: number;
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
 * 
 * 方向选择说明：
 * - 指定 direction 参数时，将在指定方向的相对位置搜索目标方块
 * - 不指定 direction 时，在附近搜索（原有行为）
 * - 支持的方向：up, down, north, south, east, west
 * - 搜索策略：在指定范围内寻找距离机器人最近的方块，避免挖掘最深层方块
 */
export class MineBlockAction extends BaseAction<MineBlockParams> {
  name = 'mineBlock';
  description = '挖掘指定类型的方块（按名称），支持方向选择';
  schema = z.object({
    name: z.string().describe('方块名称 (字符串)'),
    count: z.number().int().min(1).optional().describe('挖掘数量 (数字，可选，默认 1)'),
    bypassAllCheck: z.boolean().optional().describe('是否绕过所有检查，直接挖掘，默认false'),
    direction: z.enum(['up', 'down', 'north', 'south', 'east', 'west']).optional().describe('挖掘方向 (up | down | north | south | east | west，可选)'),
    maxDistance: z.number().int().min(1).max(100).optional().describe('搜索距离 (数字，可选，默认 48，最大100格)'),
  });

  // 校验和 schema 描述由基类提供

  async execute(bot: Bot, params: MineBlockParams): Promise<ActionResult> {
    try {
      const count = params.count ?? 1;
      const bypassAllCheck = params.bypassAllCheck ?? false;
      const maxDistance = params.maxDistance ?? 48;
      
      this.logger.info(`开始挖掘方块: ${params.name}, 数量: ${count}, 绕过所有检查: ${bypassAllCheck}, 方向: ${params.direction || '附近搜索'}`);
      
      const mcData = bot.registry;
      const blockByName = mcData.blocksByName[params.name];

      if (!blockByName) {
        this.logger.error(`未找到名为 ${params.name} 的方块`);
        return this.createErrorResult(`未找到名为 ${params.name} 的方块`, 'BLOCK_NOT_FOUND');
      }
      this.logger.info(`找到方块定义: ${blockByName.name} (ID: ${blockByName.id})`);

      let successCount = 0;
      let fallbackCount = 0;

      // 搜索目标方块
      for (let i = 0; i < count; i++) {
        let block;
        
        if (params.direction) {
          // 按指定方向搜索
          block = this.findBlockInDirection(bot, blockByName.id, params.direction, maxDistance);
        } else {
          // 在附近搜索（原有行为）
          block = bot.findBlock({
            matching: [blockByName.id],
            maxDistance: maxDistance,
          });
        }
        
        if (!block) {
          const directionText = params.direction ? `在${this.getDirectionText(params.direction)}方向` : '附近';
          this.logger.warn(`已挖掘 ${successCount} 个 ${params.name} 方块，${directionText}未找到第 ${i+1} 个，请先探索其他区域`);
          return this.createErrorResult(`已挖掘 ${successCount} 个 ${params.name} 方块，${directionText}未找到第 ${i+1} 个，请先探索其他区域`, 'NO_BLOCK_NEARBY');
        }
        
        const directionText = params.direction ? `在${this.getDirectionText(params.direction)}方向` : '';
        this.logger.info(`找到第 ${i+1} 个 ${params.name} 方块${directionText}，位置: ${block.position.x}, ${block.position.y}, ${block.position.z}`);

        if (bypassAllCheck) {
          // 绕过安全检查，直接使用bot.dig()
          this.logger.info(`绕过安全检查，直接挖掘方块`);
          await this.digBlockDirectly(bot, block);
        } else {
          // 使用collectBlock插件（包含安全检查）
          try {
            await bot.collectBlock.collect(block, { 
              ignoreNoPath: false,
              count
            });
          } catch (collectError) {
            throw collectError;
          }
        }
        
        successCount++;
        this.logger.info(`成功挖掘第 ${i+1} 个 ${params.name} 方块`);
      }

      // 成功完成挖掘
      const directionText = params.direction ? `在${this.getDirectionText(params.direction)}方向` : '';
      const resultMessage = `成功挖掘了 ${successCount} 个 ${params.name} 方块${directionText}`;
      const resultData = { 
        minedCount: successCount,
        blockName: params.name,
        direction: params.direction,
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
   * 在指定方向搜索方块
   */
  private findBlockInDirection(bot: Bot, blockId: number, direction: string, maxDistance: number): any {
    const botPos = bot.entity.position;
    const searchRange = Math.min(maxDistance, 100); // 限制单次搜索范围，避免性能问题
    
    // 根据方向计算搜索范围
    let startX = Math.floor(botPos.x);
    let startY = Math.floor(botPos.y);
    let startZ = Math.floor(botPos.z);
    let endX = startX;
    let endY = startY;
    let endZ = startZ;
    
    switch (direction) {
      case 'up':
        startY = Math.floor(botPos.y) + 1;
        endY = startY + searchRange;
        break;
      case 'down':
        startY = Math.floor(botPos.y) - searchRange;
        endY = Math.floor(botPos.y) - 1;
        break;
      case 'north':
        startZ = Math.floor(botPos.z) - searchRange;
        endZ = Math.floor(botPos.z) - 1;
        break;
      case 'south':
        startZ = Math.floor(botPos.z) + 1;
        endZ = startZ + searchRange;
        break;
      case 'east':
        startX = Math.floor(botPos.x) + 1;
        endX = startX + searchRange;
        break;
      case 'west':
        startX = Math.floor(botPos.x) - searchRange;
        endX = Math.floor(botPos.x) - 1;
        break;
    }
    
    // 寻找最近的方块，而不是搜索范围内的第一个
    let closestBlock: any = null;
    let closestDistance = Infinity;
    
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        for (let z = startZ; z <= endZ; z++) {
          const block = bot.blockAt(new Vec3(x, y, z));
          if (block && block.type === blockId) {
            // 计算到机器人的距离
            const distance = Math.sqrt(
              Math.pow(botPos.x - block.position.x, 2) +
              Math.pow(botPos.y - block.position.y, 2) +
              Math.pow(botPos.z - block.position.z, 2)
            );
            if (distance < closestDistance) {
              closestDistance = distance;
              closestBlock = block;
            }
          }
        }
      }
    }
    
    return closestBlock;
  }

  /**
   * 获取方向的中文描述
   */
  private getDirectionText(direction: string): string {
    const directionMap: Record<string, string> = {
      'up': '上方',
      'down': '下方',
      'north': '北方',
      'south': '南方',
      'east': '东方',
      'west': '西方'
    };
    return directionMap[direction] || direction;
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