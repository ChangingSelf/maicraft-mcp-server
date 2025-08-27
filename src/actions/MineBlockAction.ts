import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Vec3 } from 'vec3';

interface MineBlockParams extends BaseActionParams {
  /** 方块名称，例如 "dirt"。当提供坐标时可选，用于验证方块类型 */
  name?: string;
  /** 需要挖掘的数量，默认 1 */
  count?: number;
  /** 是否绕过所有检查，直接挖掘 */
  bypassAllCheck?: boolean;
  /** 挖掘方向，可选值：+y, -y, +z, -z, +x, -x。不指定时在附近搜索 */
  direction?: '+y' | '-y' | '+z' | '-z' | '+x' | '-x';
  /** 搜索距离，默认 48 */
  maxDistance?: number;
  /** 目标坐标 X (整数，当指定坐标时必需) */
  x?: number;
  /** 目标坐标 Y (整数，当指定坐标时必需) */
  y?: number;
  /** 目标坐标 Z (整数，当指定坐标时必需) */
  z?: number;
  /** 是否使用相对坐标 (布尔值，可选，默认false为绝对坐标) */
  useRelativeCoords?: boolean;
}

/**
 * MineBlockAction - 挖掘方块，支持三种挖掘模式：搜索模式、坐标模式、方向模式。
 * 逻辑主要参照 MineLand 的 high_level_action/mineBlock.js。
 * 
 * 挖掘模式说明：
 * - 搜索模式：提供 name 参数，在附近或指定方向搜索目标方块
 * - 坐标模式：提供 x, y, z 坐标参数，精准挖掘指定位置的方块，name 参数可选（用于验证）
 * - 方向模式：提供 direction 参数，朝着指定方向挖掘指定数量的方块，不需要指定方块名称
 * 
 * 参数组合规则：
 * - 搜索模式：必须提供 name 参数，可选择性提供 direction 参数
 * - 坐标模式：必须提供 x, y, z 参数，name 参数可选（用于验证方块类型）
 * - 方向模式：必须提供 direction 参数，不能提供 name 参数
 * - 至少需要提供以下参数之一：name、坐标(x,y,z)、direction
 * 
 * 安全机制说明：
 * - 默认使用collectBlock插件进行挖掘，包含安全检查
 * - 当遇到"Block is not safe to break!"错误时，可能的原因：
 *   1. 方块上方有会掉落的方块（如沙子、沙砾）
 *   2. 方块上方有实体
 *   3. 方块周围有液体
 * - 可以通过bypassAllCheck参数绕过安全检查
 * 
 * 方向选择说明：
 * - 搜索模式：指定 direction 参数时，将在指定方向的相对位置搜索目标方块
 * - 方向模式：指定 direction 参数时，将朝着指定方向逐个挖掘方块
 * - 支持的方向：+y, -y, +z, -z, +x, -x（坐标轴方向）
 * - 搜索策略：在指定范围内寻找距离机器人最近的方块，避免挖掘最深层方块
 * 
 * 坐标模式说明：
 * - 提供 x, y, z 参数时启用精准坐标挖掘
 * - useRelativeCoords 参数控制坐标类型：true为相对坐标，false为绝对坐标
 * - 相对坐标基于机器人当前位置计算
 * - 如果提供了 name 参数，会验证目标位置的方块类型是否匹配期望的方块名称
 * 
 * 方向模式说明：
 * - 提供 direction 参数时启用方向挖掘
 * - 从机器人当前位置开始，朝着指定方向逐个挖掘方块
 * - 不限制方块类型，挖掘路径上的所有方块
 * - 如果某个位置没有方块，会跳过并继续下一个位置
 */
export class MineBlockAction extends BaseAction<MineBlockParams> {
  name = 'mineBlock';
  description = '挖掘方块，支持三种模式：按名称搜索、精准坐标指定、方向挖掘';
  schema = z.object({
    name: z.string().optional().describe('方块名称 (字符串，当提供坐标时可选，用于验证方块类型)'),
    count: z.number().int().min(1).optional().describe('挖掘数量 (数字，可选，默认 1)'),
    bypassAllCheck: z.boolean().optional().describe('是否绕过所有检查，直接挖掘，默认false'),
    direction: z.enum(['+y', '-y', '+z', '-z', '+x', '-x']).optional().describe('挖掘方向 (+y | -y | +z | -z | +x | -x，可选，默认附近搜索)'),
    maxDistance: z.number().int().min(1).max(100).optional().describe('搜索距离 (数字，可选，默认 48，最大100格)'),
    x: z.number().int().optional().describe('目标坐标 X (整数，当指定坐标时必需)'),
    y: z.number().int().optional().describe('目标坐标 Y (整数，当指定坐标时必需)'),
    z: z.number().int().optional().describe('目标坐标 Z (整数，当指定坐标时必需)'),
    useRelativeCoords: z.boolean().optional().describe('是否使用相对坐标 (布尔值，可选，默认false为绝对坐标)'),
  });

  // 校验和 schema 描述由基类提供

  async execute(bot: Bot, params: MineBlockParams): Promise<ActionResult> {
    try {
      const count = params.count ?? 1;
      const bypassAllCheck = params.bypassAllCheck ?? false;
      const maxDistance = params.maxDistance ?? 48;
      const useRelativeCoords = params.useRelativeCoords ?? false;
      
      // 检查是否提供了坐标参数
      const hasCoordinates = params.x !== undefined && params.y !== undefined && params.z !== undefined;
      
      // 验证参数组合的合理性
      const hasDirection = params.direction !== undefined;
      const hasName = params.name !== undefined;
      
      if (!hasCoordinates && !hasName && !hasDirection) {
        this.logger.error('必须提供以下参数之一：方块名称、坐标、或挖掘方向');
        return this.createErrorResult('必须提供以下参数之一：方块名称、坐标、或挖掘方向', 'INVALID_PARAMS');
      }
      
      this.logger.info(`开始挖掘方块: ${params.name || '坐标模式'}, 数量: ${count}, 绕过所有检查: ${bypassAllCheck}, 方向: ${params.direction || '附近搜索'}, 坐标模式: ${hasCoordinates ? '精准坐标' : '搜索模式'}`);
      
      let blockByName: any = null;
      if (params.name) {
        const mcData = bot.registry;
        blockByName = mcData.blocksByName[params.name];

        if (!blockByName) {
          this.logger.error(`未找到名为 ${params.name} 的方块`);
          return this.createErrorResult(`未找到名为 ${params.name} 的方块`, 'BLOCK_NOT_FOUND');
        }
        this.logger.info(`找到方块定义: ${blockByName.name} (ID: ${blockByName.id})`);
      }

      let successCount = 0;
      let fallbackCount = 0;

      // 根据参数组合选择挖掘策略
      if (hasCoordinates) {
        // 精准坐标挖掘模式
        successCount = await this.mineAtCoordinates(bot, params, blockByName, count, bypassAllCheck, useRelativeCoords);
      } else if (hasDirection && !hasName) {
        // 方向挖掘模式：朝着指定方向挖掘指定数量的方块
        successCount = await this.mineInDirection(bot, params, count, bypassAllCheck, maxDistance);
      } else {
        // 搜索挖掘模式（原有逻辑）- 此时 blockByName 一定不为 null
        successCount = await this.mineBySearch(bot, params, blockByName!, count, bypassAllCheck, maxDistance);
      }

      // 成功完成挖掘
      const directionText = params.direction ? `在${this.getDirectionText(params.direction)}方向` : '';
      const coordinateText = hasCoordinates ? `在坐标 (${params.x}, ${params.y}, ${params.z})` : '';
      let blockNameText: string;
      if (hasDirection && !hasName && !hasCoordinates) {
        // 方向挖掘模式
        blockNameText = '方块';
      } else {
        blockNameText = params.name || (hasCoordinates ? '指定坐标的方块' : '方块');
      }
      const resultMessage = `成功挖掘了 ${successCount} 个 ${blockNameText}${directionText}${coordinateText}`;
      const resultData = { 
        minedCount: successCount,
        blockName: params.name,
        direction: params.direction,
        coordinates: hasCoordinates ? { x: params.x, y: params.y, z: params.z, useRelativeCoords } : undefined,
        fallbackCount: fallbackCount
      };
      
      if (fallbackCount > 0) {
        this.logger.info(`${resultMessage}（其中 ${fallbackCount} 个使用了直接挖掘绕过安全检查）`);
      }
      
      return this.createSuccessResult(resultMessage, resultData);
    } catch (err) {
      const hasCoordinates = params.x !== undefined && params.y !== undefined && params.z !== undefined;
      const hasDirection = params.direction !== undefined;
      const hasName = params.name !== undefined;
      
      let blockNameText: string;
      if (hasDirection && !hasName && !hasCoordinates) {
        // 方向挖掘模式
        blockNameText = '方块';
      } else {
        blockNameText = params.name || (hasCoordinates ? '指定坐标的方块' : '方块');
      }
      
      this.logger.error(`挖掘 ${blockNameText} 失败: ${err instanceof Error ? err.message : String(err)}`);
      return this.createExceptionResult(err, `挖掘 ${blockNameText} 失败`, 'MINE_FAILED');
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
      case '+y':
        startY = Math.floor(botPos.y) + 1;
        endY = startY + searchRange;
        break;
      case '-y':
        startY = Math.floor(botPos.y) - searchRange;
        endY = Math.floor(botPos.y) - 1;
        break;
      case '+z':
        startZ = Math.floor(botPos.z) + 1;
        endZ = startZ + searchRange;
        break;
      case '-z':
        startZ = Math.floor(botPos.z) - searchRange;
        endZ = Math.floor(botPos.z) - 1;
        break;
      case '+x':
        startX = Math.floor(botPos.x) + 1;
        endX = startX + searchRange;
        break;
      case '-x':
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
      '+y': 'Y轴正方向',
      '-y': 'Y轴负方向',
      '+z': 'Z轴正方向',
      '-z': 'Z轴负方向',
      '+x': 'X轴正方向',
      '-x': 'X轴负方向'
    };
    return directionMap[direction] || direction;
  }

  /**
   * 精准坐标挖掘模式
   */
  private async mineAtCoordinates(
    bot: Bot, 
    params: MineBlockParams, 
    blockByName: any, 
    count: number, 
    bypassAllCheck: boolean, 
    useRelativeCoords: boolean
  ): Promise<number> {
    const botPos = bot.entity.position;
    let targetX = params.x!;
    let targetY = params.y!;
    let targetZ = params.z!;
    
    // 如果是相对坐标，需要加上机器人当前位置
    if (useRelativeCoords) {
      targetX = Math.floor(botPos.x) + targetX;
      targetY = Math.floor(botPos.y) + targetY;
      targetZ = Math.floor(botPos.z) + targetZ;
    }
    
    this.logger.info(`准备挖掘坐标 (${targetX}, ${targetY}, ${targetZ}) 的方块，相对坐标模式: ${useRelativeCoords}`);
    
    // 获取目标位置的方块
    const targetBlock = bot.blockAt(new Vec3(targetX, targetY, targetZ));
    
    if (!targetBlock) {
      this.logger.error(`目标坐标 (${targetX}, ${targetY}, ${targetZ}) 没有方块`);
      throw new Error(`目标坐标 (${targetX}, ${targetY}, ${targetZ}) 没有方块`);
    }
    
    // 如果提供了方块名称，检查方块类型是否匹配
    if (blockByName && targetBlock.type !== blockByName.id) {
      this.logger.error(`目标坐标 (${targetX}, ${targetY}, ${targetZ}) 的方块类型是 ${targetBlock.name}，不是期望的 ${params.name}`);
      throw new Error(`目标坐标 (${targetX}, ${targetY}, ${targetZ}) 的方块类型是 ${targetBlock.name}，不是期望的 ${params.name}`);
    }
    
    this.logger.info(`找到目标方块: ${targetBlock.name} 在坐标 (${targetX}, ${targetY}, ${targetZ})`);
    
    let successCount = 0;
    
    // 挖掘指定数量的方块（在坐标模式下，通常只挖掘一个）
    for (let i = 0; i < count; i++) {
      if (bypassAllCheck) {
        // 绕过安全检查，直接使用bot.dig()
        this.logger.info(`绕过安全检查，直接挖掘方块`);
        await this.digBlockDirectly(bot, targetBlock);
      } else {
        // 使用collectBlock插件（包含安全检查）
        try {
          await bot.collectBlock.collect(targetBlock, { 
            ignoreNoPath: false,
            count: 1
          });
        } catch (collectError) {
          throw collectError;
        }
      }
      
      successCount++;
      const blockNameText = params.name || targetBlock.name;
      this.logger.info(`成功挖掘第 ${i+1} 个 ${blockNameText} 方块在坐标 (${targetX}, ${targetY}, ${targetZ})`);
    }
    
    return successCount;
  }

  /**
   * 方向挖掘模式：朝着指定方向挖掘指定数量的方块
   */
  private async mineInDirection(
    bot: Bot, 
    params: MineBlockParams, 
    count: number, 
    bypassAllCheck: boolean, 
    maxDistance: number
  ): Promise<number> {
    let successCount = 0;
    const botPos = bot.entity.position;
    
    this.logger.info(`开始方向挖掘模式：方向 ${this.getDirectionText(params.direction!)}, 数量: ${count}`);
    
    // 计算挖掘的起始位置（机器人前方一格）
    let currentX = Math.floor(botPos.x);
    let currentY = Math.floor(botPos.y);
    let currentZ = Math.floor(botPos.z);
    
    // 根据方向调整起始位置
    switch (params.direction) {
      case '+y':
        currentY += 1;
        break;
      case '-y':
        currentY -= 1;
        break;
      case '+z':
        currentZ += 1;
        break;
      case '-z':
        currentZ -= 1;
        break;
      case '+x':
        currentX += 1;
        break;
      case '-x':
        currentX -= 1;
        break;
    }
    
    // 逐个挖掘指定方向的方块
    for (let i = 0; i < count; i++) {
      const targetPos = new Vec3(currentX, currentY, currentZ);
      const block = bot.blockAt(targetPos);
      
      if (!block) {
        this.logger.warn(`位置 (${currentX}, ${currentY}, ${currentZ}) 没有方块，跳过`);
        // 继续下一个位置
      } else {
        this.logger.info(`挖掘第 ${i+1} 个方块: ${block.name} 在位置 (${currentX}, ${currentY}, ${currentZ})`);
        
        if (bypassAllCheck) {
          // 绕过安全检查，直接使用bot.dig()
          this.logger.info(`绕过安全检查，直接挖掘方块`);
          await this.digBlockDirectly(bot, block);
        } else {
          // 使用collectBlock插件（包含安全检查）
          try {
            await bot.collectBlock.collect(block, { 
              ignoreNoPath: false,
              count: 1
            });
          } catch (collectError) {
            this.logger.warn(`挖掘方块失败: ${collectError instanceof Error ? collectError.message : String(collectError)}`);
            // 继续下一个方块，不中断整个流程
            continue;
          }
        }
        
        successCount++;
      }
      
      // 移动到下一个位置
      switch (params.direction) {
        case '+y':
          currentY += 1;
          break;
        case '-y':
          currentY -= 1;
          break;
        case '+z':
          currentZ += 1;
          break;
        case '-z':
          currentZ -= 1;
          break;
        case '+x':
          currentX += 1;
          break;
        case '-x':
          currentX -= 1;
          break;
      }
    }
    
    this.logger.info(`方向挖掘完成，成功挖掘了 ${successCount} 个方块`);
    return successCount;
  }

  /**
   * 搜索挖掘模式（原有逻辑）
   */
  private async mineBySearch(
    bot: Bot, 
    params: MineBlockParams, 
    blockByName: any, 
    count: number, 
    bypassAllCheck: boolean, 
    maxDistance: number
  ): Promise<number> {
    let successCount = 0;
    
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
        throw new Error(`已挖掘 ${successCount} 个 ${params.name} 方块，${directionText}未找到第 ${i+1} 个，请先探索其他区域`);
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
            count: 1
          });
        } catch (collectError) {
          throw collectError;
        }
      }
      
      successCount++;
      this.logger.info(`成功挖掘第 ${i+1} 个 ${params.name} 方块`);
    }
    
    return successCount;
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