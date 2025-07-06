import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { GameAction, ActionResult, BaseActionParams } from '../minecraft/ActionInterface';

interface UseChestParams extends BaseActionParams {
  /** store | withdraw */
  action: string;
  /** 物品名称 */
  item: string;
  /** 数量，默认 1 */
  count?: number;
}

export class UseChestAction implements GameAction<UseChestParams> {
  name = 'useChest';
  description = '与附近箱子交互，存取物品';

  validateParams(p: UseChestParams): boolean {
    return typeof p.action === 'string' && typeof p.item === 'string';
  }

  getParamsSchema(): Record<string, string> {
    return { action: 'store | withdraw', item: '物品名称', count: '数量 (可选)' };
  }

  async execute(bot: Bot, params: UseChestParams): Promise<ActionResult> {
    try {
      const action = params.action.toLowerCase();
      const count = params.count ?? 1;
      const mcData = minecraftData(bot.version);
      const itemMeta = mcData.itemsByName[params.item];
      if (!itemMeta) return { success: false, message: `未知物品 ${params.item}`, error: 'ITEM_NOT_FOUND' };

      // 找到最近箱子
      const chestBlock = bot.findBlock({ matching: mcData.blocksByName.chest.id, maxDistance: 16 });
      if (!chestBlock) return { success: false, message: '附近没有箱子', error: 'CHEST_NOT_FOUND' };

      // 移动到箱子附近
      if (bot.pathfinder?.goto) {
        const { goals } = await import('mineflayer-pathfinder');
        const GoalLookAtBlock = (goals as any).GoalLookAtBlock ?? goals.GoalNear;
        const goal = new GoalLookAtBlock(chestBlock.position, bot.world as any);
        await bot.pathfinder.goto(goal);
      }

      const chest = await bot.openContainer(chestBlock);

      if (action === 'store') {
        const invItem = bot.inventory.findInventoryItem(itemMeta.id, null, false);
        if (!invItem) { chest.close(); return { success: false, message: `背包没有 ${params.item}`, error: 'NO_ITEM' }; }
        await chest.deposit(itemMeta.id, null, Math.min(count, invItem.count));
        chest.close();
        return { success: true, message: `已存入 ${params.item}` };
      } else if (action === 'withdraw') {
        const chestItem = chest.containerItems().find(it => it.type === itemMeta.id);
        if (!chestItem) { chest.close(); return { success: false, message: `箱子中没有 ${params.item}`, error: 'NO_ITEM_IN_CHEST' }; }
        await chest.withdraw(itemMeta.id, null, Math.min(count, chestItem.count));
        chest.close();
        return { success: true, message: `已取出 ${params.item}` };
      } else {
        chest.close();
        return { success: false, message: `未知动作 ${params.action}`, error: 'INVALID_ACTION' };
      }
    } catch (err) {
      return { success: false, message: `箱子交互失败: ${err instanceof Error ? err.message : String(err)}`, error: 'CHEST_FAILED' };
    }
  }
} 