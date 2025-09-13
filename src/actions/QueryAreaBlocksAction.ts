import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Vec3 } from 'vec3';

interface QueryAreaBlocksParams extends BaseActionParams {
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  useRelativeCoords?: boolean;
  maxBlocks?: number;
  compressionMode?: boolean;
  includeBlockCounts?: boolean;
  filterInvisibleBlocks?: boolean;
}

interface BlockInfo {
  x: number;
  y: number;
  z: number;
  name: string;
  displayName: string;
  hardness: number;
  material: string;
  harvestTools: string[];
  drops: string[];
  lightLevel?: number;
  isSolid: boolean;
  isTransparent: boolean;
  boundingBox: string;
  stateId?: number;
  metadata?: any;
  canSee: boolean;
}

interface CompressedBlockInfo {
  name: string;
  displayName: string;
  count: number;
  hardness: number;
  material: string;
  harvestTools: string[];
  drops: string[];
  positions: Array<{x: number, y: number, z: number}>;
  lightLevel?: number;
  isSolid: boolean;
  isTransparent: boolean;
  boundingBox: string;
  canSee: boolean;
}

export class QueryAreaBlocksAction extends BaseAction<QueryAreaBlocksParams> {
  name = 'queryAreaBlocks';
  description = '查询指定对角线区域内的所有非空气方块信息，支持相对坐标、透视模式和压缩模式';
  schema = z.object({
    startX: z.number().int().describe('区域起始坐标 X (整数)'),
    startY: z.number().int().describe('区域起始坐标 Y (整数)'),
    startZ: z.number().int().describe('区域起始坐标 Z (整数)'),
    endX: z.number().int().describe('区域结束坐标 X (整数)'),
    endY: z.number().int().describe('区域结束坐标 Y (整数)'),
    endZ: z.number().int().describe('区域结束坐标 Z (整数)'),
    useRelativeCoords: z.boolean().optional().describe('是否使用相对坐标 (布尔值，可选，默认 false 为绝对坐标)'),
    maxBlocks: z.number().int().min(1).optional().describe('最大查询方块数量 (整数，可选，默认无限制)'),
    compressionMode: z.boolean().optional().describe('是否启用压缩模式，按方块类型分组统计 (布尔值，可选，默认false)'),
    includeBlockCounts: z.boolean().optional().describe('是否包含方块数量统计 (布尔值，可选，默认true)'),
    filterInvisibleBlocks: z.boolean().optional().describe('是否过滤不可见方块 (布尔值，可选，默认false不过滤)')
  });

  async execute(bot: Bot, params: QueryAreaBlocksParams): Promise<ActionResult> {
    try {
      this.logger.info(`查询区域方块信息: 从 (${params.startX}, ${params.startY}, ${params.startZ}) 到 (${params.endX}, ${params.endY}, ${params.endZ})`);

      // 验证坐标范围
      if (!this.validateCoordinates(params)) {
        return this.createErrorResult(
          '无效的坐标范围：起始坐标不能大于结束坐标',
          'INVALID_COORDINATES'
        );
      }

      // 计算区域大小
      const regionSize = this.calculateRegionSize(params);

      // 根据参数确定坐标类型
      let startPos: Vec3;
      let endPos: Vec3;

      if (params.useRelativeCoords) {
        // 相对坐标（相对于bot当前位置）
        const botPos = bot.entity.position;
        startPos = new Vec3(
          Math.floor(botPos.x) + params.startX,
          Math.floor(botPos.y) + params.startY,
          Math.floor(botPos.z) + params.startZ
        );
        endPos = new Vec3(
          Math.floor(botPos.x) + params.endX,
          Math.floor(botPos.y) + params.endY,
          Math.floor(botPos.z) + params.endZ
        );
      } else {
        // 绝对坐标
        startPos = new Vec3(params.startX, params.startY, params.startZ);
        endPos = new Vec3(params.endX, params.endY, params.endZ);
      }

      const maxBlocks = params.maxBlocks ?? Number.MAX_SAFE_INTEGER; // 无限制
      const compressionMode = params.compressionMode ?? false;
      const includeBlockCounts = params.includeBlockCounts ?? true;
      const filterInvisibleBlocks = params.filterInvisibleBlocks ?? false;

      // 查询区域内所有方块
      const blocks: BlockInfo[] = [];
      const compressedBlocks: Map<string, CompressedBlockInfo> = new Map();
      const queriedBlocks = new Set<string>();

      let processedBlocks = 0;
      let skippedBlocks = 0;

      // 遍历区域内的所有坐标
      for (let x = Math.min(startPos.x, endPos.x); x <= Math.max(startPos.x, endPos.x); x++) {
        for (let y = Math.min(startPos.y, endPos.y); y <= Math.max(startPos.y, endPos.y); y++) {
          for (let z = Math.min(startPos.z, endPos.z); z <= Math.max(startPos.z, endPos.z); z++) {


            const position = new Vec3(x, y, z);
            const blockKey = `${x},${y},${z}`;

            // 跳过已查询的方块
            if (queriedBlocks.has(blockKey)) {
              continue;
            }

            const block = bot.blockAt(position, true);

            if (!block) {
              skippedBlocks++;
              continue;
            }

            // 跳过空气方块
            if (block.name === 'air') {
              continue;
            }

            // 检查方块是否可见
            const canSee = bot.canSeeBlock(block);
            // 确保canSee字段始终为boolean值
            const canSeeResult = typeof canSee === 'boolean' ? canSee : false;

            // 如果需要过滤不可见方块且方块不可见，则跳过
            if (filterInvisibleBlocks && !canSeeResult) {
              continue;
            }

            // 收集方块信息
            const blockInfo = this.extractBlockInfo(block, position, canSeeResult);

            if (compressionMode) {
              // 压缩模式：按方块名称分组
              const blockKeyForCompression = block.name;
              if (compressedBlocks.has(blockKeyForCompression)) {
                const compressed = compressedBlocks.get(blockKeyForCompression)!;
                compressed.count++;
                compressed.positions.push({ x: position.x, y: position.y, z: position.z });
              } else {
                compressedBlocks.set(blockKeyForCompression, {
                  name: blockInfo.name,
                  displayName: blockInfo.displayName,
                  count: 1,
                  hardness: blockInfo.hardness,
                  material: blockInfo.material,
                  harvestTools: blockInfo.harvestTools,
                  drops: blockInfo.drops,
                  lightLevel: blockInfo.lightLevel,
                  isSolid: blockInfo.isSolid,
                  isTransparent: blockInfo.isTransparent,
                  boundingBox: blockInfo.boundingBox,
                  canSee: blockInfo.canSee,
                  positions: [{ x: position.x, y: position.y, z: position.z }]
                });
              }
            } else {
              // 普通模式：保留所有详细信息
              blocks.push(blockInfo);
            }

            queriedBlocks.add(blockKey);
            processedBlocks++;

            // 避免阻塞事件循环，每处理1000个方块让出控制权
            if (processedBlocks % 1000 === 0) {
              await new Promise(resolve => setImmediate(resolve));
            }
          }

        }

        if (processedBlocks >= maxBlocks) break;
      }

      // 准备返回结果
      let resultData: any = {};

      if (compressionMode) {
        // 压缩模式：转换Map为数组并添加统计信息
        const compressedBlocksArray = Array.from(compressedBlocks.values());

        // 按数量排序
        compressedBlocksArray.sort((a, b) => b.count - a.count);

        resultData = {
          queryParams: {
            startPosition: { x: params.startX, y: params.startY, z: params.startZ },
            endPosition: { x: params.endX, y: params.endY, z: params.endZ },
            actualStartPosition: { x: startPos.x, y: startPos.y, z: startPos.z },
            actualEndPosition: { x: endPos.x, y: endPos.y, z: endPos.z },
            useRelativeCoords: params.useRelativeCoords || false,
            maxBlocks,
            compressionMode: true
          },
          statistics: {
            regionSize,
            uniqueBlockTypes: compressedBlocksArray.length,
            totalBlocks: processedBlocks,
            skippedBlocks,
            queryLimitReached: processedBlocks >= maxBlocks,
            compressionRatio: compressedBlocksArray.length > 0 ? (processedBlocks / compressedBlocksArray.length).toFixed(2) : '0'
          },
          compressedBlocks: compressedBlocksArray
        };

        this.logger.info(`区域查询完成（压缩模式）: 找到 ${compressedBlocksArray.length} 种方块类型，共 ${processedBlocks} 个方块，跳过 ${skippedBlocks} 个方块`);
      } else {
        // 普通模式：返回详细的方块信息
        resultData = {
          queryParams: {
            startPosition: { x: params.startX, y: params.startY, z: params.startZ },
            endPosition: { x: params.endX, y: params.endY, z: params.endZ },
            actualStartPosition: { x: startPos.x, y: startPos.y, z: startPos.z },
            actualEndPosition: { x: endPos.x, y: endPos.y, z: endPos.z },
            useRelativeCoords: params.useRelativeCoords || false,
            maxBlocks,
            compressionMode: false
          },
          statistics: {
            regionSize,
            foundBlocks: blocks.length,
            skippedBlocks,
            processedBlocks,
            queryLimitReached: processedBlocks >= maxBlocks
          },
          blocks
        };

        // 如果启用了方块计数统计，添加按类型分组的统计
        if (includeBlockCounts && blocks.length > 0) {
          const blockCounts: Record<string, number> = {};
          blocks.forEach(block => {
            blockCounts[block.name] = (blockCounts[block.name] || 0) + 1;
          });

          // 转换为排序后的数组
          const blockCountArray = Object.entries(blockCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          resultData.blockCounts = blockCountArray;
          resultData.statistics.uniqueBlockTypes = blockCountArray.length;
        }

        this.logger.info(`区域查询完成: 找到 ${blocks.length} 个非空气方块，跳过 ${skippedBlocks} 个方块`);
      }

      const foundBlocks = compressionMode ? processedBlocks : blocks.length;
      return this.createSuccessResult(`成功查询区域方块信息，共找到 ${foundBlocks} 个非空气方块`, resultData);

    } catch (error) {
      this.logger.error(`查询区域方块信息失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询区域方块信息失败', 'QUERY_AREA_BLOCKS_FAILED');
    }
  }

  /**
   * 验证坐标范围是否有效
   */
  private validateCoordinates(params: QueryAreaBlocksParams): boolean {
    const startX = params.startX;
    const startY = params.startY;
    const startZ = params.startZ;
    const endX = params.endX;
    const endY = params.endY;
    const endZ = params.endZ;

    // 检查坐标范围：起始坐标应该小于或等于结束坐标
    return Math.abs(startX - endX) >= 0 && Math.abs(startY - endY) >= 0 && Math.abs(startZ - endZ) >= 0;
  }

  /**
   * 计算区域大小
   */
  private calculateRegionSize(params: QueryAreaBlocksParams): number {
    const width = Math.abs(params.endX - params.startX) + 1;
    const height = Math.abs(params.endY - params.startY) + 1;
    const depth = Math.abs(params.endZ - params.startZ) + 1;
    return width * height * depth;
  }

  /**
   * 提取方块信息
   */
  private extractBlockInfo(block: any, position: Vec3, canSee: boolean): BlockInfo {
    // 获取方块的掉落物品
    const drops = block.drops?.map((drop: any) => drop.name) || [];

    // 获取收获工具信息
    const harvestTools: string[] = [];
    if (block.harvestTools) {
      for (const toolId of Object.keys(block.harvestTools)) {
        const toolName = this.getToolNameById(parseInt(toolId));
        if (toolName) {
          harvestTools.push(toolName);
        }
      }
    }

    // 获取边界框信息
    let boundingBox = 'none';
    if (block.boundingBox === 'block') {
      boundingBox = 'block';
    } else if (block.boundingBox === 'empty') {
      boundingBox = 'empty';
    }

    return {
      x: position.x,
      y: position.y,
      z: position.z,
      name: block.name,
      displayName: block.displayName || block.name,
      hardness: block.hardness || 0,
      material: block.material || 'unknown',
      harvestTools,
      drops,
      lightLevel: block.light,
      isSolid: block.boundingBox === 'block',
      isTransparent: block.transparent || false,
      boundingBox,
      stateId: block.stateId,
      metadata: block.metadata || {},
      canSee
    };
  }

  /**
   * 根据工具ID获取工具名称
   */
  private getToolNameById(toolId: number): string | null {
    const toolMap: Record<number, string> = {
      0: 'wooden_pickaxe',
      1: 'wooden_shovel',
      2: 'wooden_axe',
      3: 'wooden_hoe',
      4: 'stone_pickaxe',
      5: 'stone_shovel',
      6: 'stone_axe',
      7: 'stone_hoe',
      8: 'iron_pickaxe',
      9: 'iron_shovel',
      10: 'iron_axe',
      11: 'iron_hoe',
      12: 'diamond_pickaxe',
      13: 'diamond_shovel',
      14: 'diamond_axe',
      15: 'diamond_hoe',
      16: 'golden_pickaxe',
      17: 'golden_shovel',
      18: 'golden_axe',
      19: 'golden_hoe',
      20: 'netherite_pickaxe',
      21: 'netherite_shovel',
      22: 'netherite_axe',
      23: 'netherite_hoe'
    };

    return toolMap[toolId] || null;
  }
}
