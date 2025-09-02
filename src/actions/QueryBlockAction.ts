import { Bot, Furnace } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Vec3 } from 'vec3';
import { MoveAction } from './MoveAction.js';

interface QueryBlockParams extends BaseActionParams {
  x: number;
  y: number;
  z: number;
  useRelativeCoords?: boolean;
  includeContainerInfo?: boolean;
  enable_xray?: boolean;
}

export class QueryBlockAction extends BaseAction<QueryBlockParams> {
  name = 'queryBlock';
  description = '查询指定坐标处方块的详细信息，包括方块类型、状态、实体等，支持容器内容查询';
  schema = z.object({
    x: z.number().int().describe('目标坐标 X (整数)'),
    y: z.number().int().describe('目标坐标 Y (整数)'),
    z: z.number().int().describe('目标坐标 Z (整数)'),
    useRelativeCoords: z.boolean().optional().describe('是否使用相对坐标 (布尔值，可选，默认 false 为绝对坐标)'),
    includeContainerInfo: z.boolean().optional().describe('是否包含容器信息 (布尔值，可选，默认 false)'),
    enable_xray: z.boolean().optional().describe('是否启用透视模式 (布尔值，可选，默认false为限制可见方块)'),
  });

  async execute(bot: Bot, params: QueryBlockParams): Promise<ActionResult> {
    try {
      this.logger.info(`查询坐标 (${params.x}, ${params.y}, ${params.z}) 处的方块信息`);

      // 根据参数确定坐标类型
      let position: Vec3;
      if (params.useRelativeCoords) {
        // 相对坐标（相对于bot当前位置）
        const botPos = bot.entity.position;
        position = new Vec3(
          Math.floor(botPos.x) + params.x,
          Math.floor(botPos.y) + params.y,
          Math.floor(botPos.z) + params.z
        );
      } else {
        // 绝对坐标
        position = new Vec3(params.x, params.y, params.z);
      }

      const enable_xray = params.enable_xray ?? false;

      // 直接返回 bot.blockAt 方法的原始结果
      const block = bot.blockAt(position, true);

      if (!block) {
        return this.createErrorResult(
          `坐标 (${position.x}, ${position.y}, ${position.z}) 处的区域未加载或不存在方块`,
          'BLOCK_NOT_LOADED'
        );
      }

      // 检查方块是否可见（如果未启用透视模式）
      if (!enable_xray && !bot.canSeeBlock(block)) {
        return this.createErrorResult(
          `坐标 (${position.x}, ${position.y}, ${position.z}) 处的方块 ${block.name} 不可见，无法查询。如需查询不可见方块，请设置enable_xray=true`,
          'BLOCK_NOT_VISIBLE'
        );
      }

      // 准备返回结果
      const result: any = {
        block,
        queryPosition: { x: params.x, y: params.y, z: params.z },
        actualPosition: { x: position.x, y: position.y, z: position.z },
        useRelativeCoords: params.useRelativeCoords || false
      };

      // 如果需要查询容器信息
      if (params.includeContainerInfo) {
        const containerBlocks = ['chest', 'trapped_chest', 'furnace', 'blast_furnace', 'smoker', 'dispenser', 'dropper'];

        if (containerBlocks.includes(block.name)) {
          try {
            this.logger.info(`正在查询容器内容: ${block.name}`);

            // 移动到容器位置附近，以便能够打开容器
            const moveAction = new MoveAction();
            const moveParams = {
              type: 'coordinate' as const,
              x: position.x,
              y: position.y,
              z: position.z,
              useRelativeCoords: false,
              distance: 5, // 距离容器3格以内
            };

            this.logger.info(`移动到容器位置: (${position.x}, ${position.y}, ${position.z})`);
            const moveResult = await moveAction.execute(bot, moveParams);

            if (!moveResult.success) {
              this.logger.warn(`移动到容器位置失败: ${moveResult.message}`);
              result.containerInfo = {
                error: `移动到容器位置失败: ${moveResult.message}`
              };
            } else {
              // 根据容器类型使用不同的方法打开容器
              let container: any = null;

              if (block.name.includes('furnace') || block.name === 'blast_furnace' || block.name === 'smoker') {
                // 熔炉类型使用 openFurnace 方法
                container = await bot.openFurnace(block);
              } else {
                // 箱子和发射器使用 openContainer 方法
                container = await bot.openContainer(block);
              }

              if (container) {
                const containerInfo: any = {
                  type: this.detectContainerType(block.name),
                  title: (container as any).title || 'Unknown',
                  slots: []
                };

                // 根据容器类型获取正确的槽位范围
                const slots = (container as any).slots || [];
                const containerSlotRanges = this.getContainerSlotRanges(containerInfo.type);

                for (let i = containerSlotRanges.start; i <= containerSlotRanges.end; i++) {
                  const item = slots[i];
                  if (item && item.name !== 'air') {
                    containerInfo.slots.push({
                      slot: i,
                      name: item.name,
                      count: item.count,
                      displayName: item.displayName,
                      maxDurability: item.maxDurability || null,
                      durabilityUsed: item.durabilityUsed || null,
                      enchantments: item.enchants || null,
                      metadata: item.metadata || null
                    });
                  } else {
                    containerInfo.slots.push({
                      slot: i,
                      name: 'air',
                      count: 0
                    });
                  }
                }

                // 根据容器类型获取不同的信息
                if (containerInfo.type === 'furnace') {
                  const furnace = container as Furnace;
                  containerInfo.furnaceInfo = {
                    inputItem: furnace.inputItem() ? {
                      name: furnace.inputItem().name,
                      count: furnace.inputItem().count,
                      displayName: furnace.inputItem().displayName
                    } : null,
                    fuelItem: furnace.fuelItem() ? {
                      name: furnace.fuelItem().name,
                      count: furnace.fuelItem().count,
                      displayName: furnace.fuelItem().displayName
                    } : null,
                    outputItem: furnace.outputItem() ? {
                      name: furnace.outputItem().name,
                      count: furnace.outputItem().count,
                      displayName: furnace.outputItem().displayName
                    } : null,
                    fuel: furnace.fuel || 0,
                    progress: furnace.progress || 0
                  };
                }

                // 统计信息
                const occupiedSlots = containerInfo.slots.filter((slot: any) => slot.name !== 'air').length;
                const totalSlots = containerInfo.slots.length;
                containerInfo.stats = {
                  totalSlots,
                  occupiedSlots,
                  emptySlots: totalSlots - occupiedSlots,
                  occupancyRate: totalSlots > 0 ? (occupiedSlots / totalSlots * 100).toFixed(1) + '%' : '0%'
                };

                result.containerInfo = containerInfo;

                // 关闭容器
                container.close();
                this.logger.info(`成功查询容器信息: ${block.name}, 占用率: ${containerInfo.stats.occupancyRate}`);
              } else {
                result.containerInfo = { error: '无法打开容器' };
              }
            }
          } catch (containerError) {
            this.logger.warn(`查询容器内容失败: ${containerError instanceof Error ? containerError.message : String(containerError)}`);
            result.containerInfo = {
              error: `查询容器内容失败: ${containerError instanceof Error ? containerError.message : String(containerError)}`
            };
          }
        } else {
          result.containerInfo = { message: '该方块不是容器类型' };
        }
      }

      this.logger.info(`成功查询方块信息: ${block.name} at (${position.x}, ${position.y}, ${position.z})`);
      return this.createSuccessResult(`成功查询方块信息`, result);

    } catch (error) {
      this.logger.error(`查询方块信息失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询方块信息失败', 'QUERY_BLOCK_FAILED');
    }
  }

  /**
   * 根据方块名称检测容器类型
   */
  private detectContainerType(blockName: string): string {
    if (blockName.includes('chest')) {
      return 'chest';
    } else if (blockName.includes('furnace') || blockName === 'blast_furnace' || blockName === 'smoker') {
      return 'furnace';
    } else if (blockName === 'dispenser' || blockName === 'dropper') {
      return 'dispenser';
    } else {
      return 'unknown';
    }
  }

  /**
   * 获取不同容器类型的槽位范围
   */
  private getContainerSlotRanges(containerType: string): { start: number; end: number } {
    switch (containerType) {
      case 'chest':
        // 箱子: 27个槽位 (0-26)
        return { start: 0, end: 26 };
      case 'furnace':
        // 熔炉: 3个槽位 (输入: 0, 燃料: 1, 输出: 2)
        return { start: 0, end: 2 };
      case 'dispenser':
        // 发射器/投掷器: 9个槽位 (0-8)
        return { start: 0, end: 8 };
      default:
        // 未知类型，返回空范围
        return { start: 0, end: -1 };
    }
  }
}
