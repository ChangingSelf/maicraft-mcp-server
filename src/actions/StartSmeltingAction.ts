import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import pathfinder from 'mineflayer-pathfinder';
import { MovementUtils } from '../utils/MovementUtils.js';

interface StartSmeltingParams extends BaseActionParams {
  /** 要熔炼的物品名称 */
  item: string;
  /** 燃料物品名称 */
  fuel: string;
  /** 熔炼数量，默认 1 */
  count?: number;
}

/**
 * StartSmeltingAction - 在熔炉中开始熔炼物品
 * 将物品放入熔炉并添加燃料开始熔炼，不等待熔炼完成
 */
export class StartSmeltingAction extends BaseAction<StartSmeltingParams> {
  name = 'startSmelting';
  description = '在熔炉中开始熔炼物品，将物品放入熔炉并添加燃料，不等待熔炼完成';
  schema = z.object({
    item: z.string().describe('要熔炼的物品 (字符串)'),
    fuel: z.string().describe('燃料物品 (字符串)'),
    count: z.number().int().min(1).optional().describe('熔炼数量 (数字，可选，默认 1)'),
  });

  async execute(bot: Bot, params: StartSmeltingParams): Promise<ActionResult> {
    try {
      const count = params.count ?? 1;
      const mcData = minecraftData(bot.version);
      const itemMeta = mcData.itemsByName[params.item];
      const fuelMeta = mcData.itemsByName[params.fuel];
      
      if (!itemMeta) {
        return this.createErrorResult(`未找到物品 ${params.item}`, 'ITEM_NOT_FOUND');
      }
      if (!fuelMeta) {
        return this.createErrorResult(`未找到燃料 ${params.fuel}`, 'FUEL_NOT_FOUND');
      }

      // 寻找熔炉
      const furnaceBlock = bot.findBlock({ matching: mcData.blocksByName.furnace.id, maxDistance: 48 });
      if (!furnaceBlock) {
        return this.createErrorResult('附近没有熔炉', 'FURNACE_NOT_FOUND');
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
      let success = 0;

      for (let i = 0; i < count; i++) {
        // 检查背包是否还有原料
        if (!bot.inventory.findInventoryItem(itemMeta.id, null, false)) break;

        // 保证有燃料
        if ((furnace as any).fuelSeconds < 15) {
          const fuelItem = bot.inventory.findInventoryItem(fuelMeta.id, null, false);
          if (!fuelItem) {
            return this.createErrorResult(`背包中没有燃料 ${params.fuel}`, 'NO_FUEL');
          }
          await furnace.putFuel(fuelMeta.id, null, 1);
          await bot.waitForTicks(20);
        }

        // 放入原料开始熔炼
        await furnace.putInput(itemMeta.id, null, 1);
        success++;
      }
      
      furnace.close();

      if (success > 0) {
        return this.createSuccessResult(`成功开始熔炼 ${params.item} × ${success}`, { 
          item: params.item, 
          count: success,
          furnacePosition: furnaceBlock.position 
        });
      }
      return this.createErrorResult(`未能开始熔炼任何 ${params.item}`, 'SMELT_START_FAILED');
    } catch (err) {
      return this.createExceptionResult(err, '开始熔炼失败', 'SMELT_START_FAILED');
    }
  }
}
