import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import pathfinder from 'mineflayer-pathfinder';

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
  schema = z.object({
    action: z.enum(['store', 'withdraw']).describe('操作类型 (store | withdraw)'),
    item: z.string().describe('物品名称 (字符串)'),
    count: z.number().int().min(1).optional().describe('数量 (数字，可选，默认 1)'),
  });

  // 校验和参数描述由基类通过 schema 自动提供

  async execute(bot: Bot, params: UseChestParams): Promise<ActionResult> {
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
        const { GoalLookAtBlock } = pathfinder.goals;
        if (!GoalLookAtBlock) {
          return this.createErrorResult('mineflayer-pathfinder goals 未加载', 'PATHFINDER_NOT_LOADED');
        }
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

  // MCP 工具由基类根据 schema 自动暴露（tool: use_chest）
} 