import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { BaseAction, BaseActionParams, McpToolSpec } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

interface SmeltItemParams extends BaseActionParams {
  /** 要熔炼的物品名称 */
  item: string;
  /** 燃料物品名称 */
  fuel: string;
  /** 熔炼数量，默认 1 */
  count?: number;
}

/**
 * SmeltItemAction - 在附近熔炉中熔炼物品
 */
export class SmeltItemAction extends BaseAction<SmeltItemParams> {
  name = 'smeltItem';
  description = '在熔炉中熔炼物品';

  validateParams(params: SmeltItemParams): boolean {
    return this.validateStringParams(params, ['item', 'fuel']) &&
           (typeof params.count === 'undefined' || typeof params.count === 'number');
  }

  getParamsSchema(): Record<string, string> {
    return {
      item: '要熔炼的物品 (字符串)',
      fuel: '燃料物品 (字符串)',
      count: '熔炼数量 (数字，可选，默认 1)'
    };
  }

  async execute(bot: Bot, params: SmeltItemParams): Promise<any> {
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
      if (bot.pathfinder?.goto) {
        const pathfinder = await import('mineflayer-pathfinder');
        const GoalLookAtBlock = pathfinder.goals.GoalLookAtBlock;
        const goal = new GoalLookAtBlock(furnaceBlock.position, bot.world as any);
        await bot.pathfinder.goto(goal);
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

        // 放入原料并等待输出
        await furnace.putInput(itemMeta.id, null, 1);
        await bot.waitForTicks(12 * 20); // 等待 12 秒左右
        if (!furnace.outputItem()) {
          return this.createErrorResult(`无法熔炼 ${params.item}，可能不是有效配方`, 'INVALID_INPUT');
        }
        await furnace.takeOutput();
        success++;
      }
      furnace.close();

      if (success > 0) {
        return this.createSuccessResult(`成功熔炼 ${params.item} × ${success}`, { item: params.item, count: success });
      }
      return this.createErrorResult(`未能熔炼任何 ${params.item}`, 'SMELT_FAILED');
    } catch (err) {
      return this.createExceptionResult(err, '熔炼失败', 'SMELT_FAILED');
    }
  }

  public override getMcpTools(): McpToolSpec[] {
    return [
      {
        toolName: 'smelt_item',
        description: 'Smelt an item in a nearby furnace.',
        schema: { item: z.string(), fuel: z.string(), count: z.number().int().min(1).optional() },
        actionName: 'smeltItem',
        mapInputToParams: (input: any) => ({ item: input.item, fuel: input.fuel, count: input.count ?? 1 }),
      },
    ];
  }
} 