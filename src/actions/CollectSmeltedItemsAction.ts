import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import pathfinder from 'mineflayer-pathfinder';
import { MovementUtils } from '../utils/MovementUtils.js';

interface CollectSmeltedItemsParams extends BaseActionParams {
  /** 要收集的熔炼产物名称（可选，如果不指定则收集所有产物） */
  item?: string;
  /** 熔炉位置坐标（整数，可选，如果不指定则寻找最近的熔炉） */
  x?: number;
  y?: number;
  z?: number;
  /** 是否使用相对坐标，默认 false */
  useRelativeCoords?: boolean;
}

/**
 * CollectSmeltedItemsAction - 从熔炉中收集已熔炼完成的物品
 * 检查熔炉输出槽并取回已熔炼完成的物品
 */
export class CollectSmeltedItemsAction extends BaseAction<CollectSmeltedItemsParams> {
  name = 'collectSmeltedItems';
  description = '从熔炉中收集已熔炼完成的物品，不指定就寻找最近的熔炉';
  schema = z.object({
    item: z.string().optional().describe('要收集的熔炼产物名称 (字符串，可选，不指定则收集所有产物)'),
    x: z.number().int().optional().describe('熔炉X坐标 (整数，可选)'),
    y: z.number().int().optional().describe('熔炉Y坐标 (整数，可选)'),
    z: z.number().int().optional().describe('熔炉Z坐标 (整数，可选)'),
    useRelativeCoords: z.boolean().optional().describe('是否使用相对坐标 (布尔值，可选，默认false)'),
  });

  async execute(bot: Bot, params: CollectSmeltedItemsParams): Promise<ActionResult> {
    try {
      const mcData = minecraftData(bot.version);
      let furnaceBlock;

      // 如果指定了坐标，使用指定位置的熔炉
      if (params.x !== undefined && params.y !== undefined && params.z !== undefined) {
        const { Vec3 } = await import('vec3');
        let position;
        
        if (params.useRelativeCoords) {
          const botPos = bot.entity.position;
          position = new Vec3(
            Math.floor(botPos.x) + params.x,
            Math.floor(botPos.y) + params.y,
            Math.floor(botPos.z) + params.z
          );
        } else {
          position = new Vec3(params.x, params.y, params.z);
        }
        
        furnaceBlock = bot.blockAt(position);
        if (!furnaceBlock || furnaceBlock.name !== 'furnace') {
          return this.createErrorResult('指定位置没有熔炉', 'FURNACE_NOT_FOUND');
        }
      } else {
        // 寻找最近的熔炉
        furnaceBlock = bot.findBlock({ matching: mcData.blocksByName.furnace.id, maxDistance: 48 });
        if (!furnaceBlock) {
          return this.createErrorResult('附近没有熔炉', 'FURNACE_NOT_FOUND');
        }
      }

      // 移动到熔炉附近
      // 使用统一的移动工具类移动到熔炉位置
      const moveResult = await MovementUtils.moveToCoordinate(
        bot,
        furnaceBlock.position.x,
        furnaceBlock.position.y,
        furnaceBlock.position.z,
        3, // 到达距离（稍微远一点，以便更好地看到熔炉）
        32, // 最大移动距离
        false // 不使用相对坐标
      );

      if (!moveResult.success) {
        this.logger.warn(`移动到熔炉失败: ${moveResult.error}，尝试直接操作熔炉`);
      }

      // 打开熔炉
      const furnace = await bot.openFurnace(furnaceBlock);
      
      // 检查输出槽
      const outputItem = furnace.outputItem();
      if (!outputItem) {
        furnace.close();
        return this.createErrorResult('熔炉中没有可收集的物品', 'NO_OUTPUT_ITEMS');
      }

      // 如果指定了特定物品，检查是否匹配
      if (params.item) {
        const expectedItemMeta = mcData.itemsByName[params.item];
        if (!expectedItemMeta) {
          furnace.close();
          return this.createErrorResult(`未找到物品 ${params.item}`, 'ITEM_NOT_FOUND');
        }
        
        if (outputItem.type !== expectedItemMeta.id) {
          furnace.close();
          return this.createErrorResult(`熔炉中的物品 ${outputItem.name} 与期望的物品 ${params.item} 不匹配`, 'ITEM_MISMATCH');
        }
      }

      // 收集所有输出物品
      const collectedItems = [];
      let totalCount = 0;
      
      while (furnace.outputItem()) {
        const item = furnace.outputItem();
        if (!item) break;
        
        await furnace.takeOutput();
        collectedItems.push({
          name: item.name,
          count: item.count,
          type: item.type
        });
        totalCount += item.count;
      }
      
      furnace.close();

      if (collectedItems.length > 0) {
        return this.createSuccessResult(`成功收集熔炼产物，共 ${totalCount} 个物品`, {
          items: collectedItems,
          totalCount: totalCount,
          furnacePosition: furnaceBlock.position
        });
      }
      
      return this.createErrorResult('未能收集到任何熔炼产物', 'COLLECT_FAILED');
    } catch (err) {
      return this.createExceptionResult(err, '收集熔炼产物失败', 'COLLECT_FAILED');
    }
  }
}
