import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { BaseAction, BaseActionParams, McpToolSpec } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

interface UseChestParams extends BaseActionParams {
  /** store | withdraw */
  action: string;
  /** 物品名称 */
  item: string;
  /** 数量，默认 1 */
  count?: number;
}

export class UseChestAction extends BaseAction<UseChestParams> {
  name = 'useChest';
  description = '与附近箱子交互，存取物品';

  validateParams(params: UseChestParams): boolean {
    return this.validateStringParams(params, ['action', 'item']) &&
           (typeof params.count === 'undefined' || typeof params.count === 'number');
  }

  getParamsSchema(): Record<string, string> {
    return { 
      action: '操作类型 (store | withdraw)', 
      item: '物品名称 (字符串)', 
      count: '数量 (数字，可选，默认 1)' 
    };
  }

  async execute(bot: Bot, params: UseChestParams): Promise<any> {
    try {
      const action = params.action.toLowerCase();
      const count = params.count ?? 1;
      const mcData = minecraftData(bot.version);
      const itemMeta = mcData.itemsByName[params.item];
      if (!itemMeta) {
        return this.createErrorResult(`未知物品 ${params.item}`, 'ITEM_NOT_FOUND');
      }

      // 找到最近箱子
      const chestBlock = bot.findBlock({ matching: mcData.blocksByName.chest.id, maxDistance: 16 });
      if (!chestBlock) {
        return this.createErrorResult('附近没有箱子', 'CHEST_NOT_FOUND');
      }

      // 移动到箱子附近
      if (bot.pathfinder?.goto) {
        const pathfinder = await import('mineflayer-pathfinder');
        const GoalLookAtBlock = pathfinder.goals.GoalLookAtBlock;
        const goal = new GoalLookAtBlock(chestBlock.position, bot.world as any);
        await bot.pathfinder.goto(goal);
      }

      const chest = await bot.openContainer(chestBlock);

      if (action === 'store') {
        const invItem = bot.inventory.findInventoryItem(itemMeta.id, null, false);
        if (!invItem) { 
          chest.close(); 
          return this.createErrorResult(`背包没有 ${params.item}`, 'NO_ITEM'); 
        }
        await chest.deposit(itemMeta.id, null, Math.min(count, invItem.count));
        chest.close();
        return this.createSuccessResult(`已存入 ${params.item}`);
      } else if (action === 'withdraw') {
        const chestItem = chest.containerItems().find(it => it.type === itemMeta.id);
        if (!chestItem) { 
          chest.close(); 
          return this.createErrorResult(`箱子中没有 ${params.item}`, 'NO_ITEM_IN_CHEST'); 
        }
        await chest.withdraw(itemMeta.id, null, Math.min(count, chestItem.count));
        chest.close();
        return this.createSuccessResult(`已取出 ${params.item}`);
      } else {
        chest.close();
        return this.createErrorResult(`未知动作 ${params.action}`, 'INVALID_ACTION');
      }
    } catch (err) {
      return this.createExceptionResult(err, '箱子交互失败', 'CHEST_FAILED');
    }
  }

  public override getMcpTools(): McpToolSpec[] {
    return [
      {
        toolName: 'use_chest',
        description: 'Interact with a nearby chest to store or withdraw items.',
        schema: { action: z.enum(['store', 'withdraw']), item: z.string(), count: z.number().int().min(1).optional() },
        actionName: 'useChest',
        mapInputToParams: (input: any) => ({ action: input.action, item: input.item, count: input.count ?? 1 }),
      },
    ];
  }
} 