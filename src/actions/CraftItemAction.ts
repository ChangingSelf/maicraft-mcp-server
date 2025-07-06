import { Bot } from 'mineflayer';
import { GameAction, ActionResult, BaseActionParams } from '../minecraft/ActionInterface';
import minecraftData from 'minecraft-data';

interface CraftItemParams extends BaseActionParams {
  item: string;
  count?: number;
}

export class CraftItemAction implements GameAction<CraftItemParams> {
  name = 'craftItem';
  description = '合成指定物品';

  async execute(bot: Bot, params: CraftItemParams): Promise<ActionResult> {
    try {
      const count = params.count ?? 1;

      // 加载 mcData
      const mcData = minecraftData(bot.version);
      const itemByName = mcData.itemsByName[params.item];
      if (!itemByName) {
        return {
          success: false,
          message: `未找到名为 ${params.item} 的物品`,
          error: 'ITEM_NOT_FOUND'
        };
      }

      // 1) 尝试寻找附近工作台
      let craftingTableBlock: any = bot.findBlock({
        matching: mcData.blocksByName.crafting_table.id,
        maxDistance: 48
      });

      // 2) 判断是否需要工作台
      const recipeWithoutTable = bot.recipesFor(itemByName.id, null, 1, null)?.[0];

      // 若未找到工作台且必须使用工作台
      if (!craftingTableBlock && !recipeWithoutTable) {
        // 检查背包是否有工作台
        const craftingTableItem = bot.inventory.findInventoryItem(mcData.itemsByName.crafting_table.id, null, false);

        if (craftingTableItem) {
          try {
            // 尝试放置工作台
            if (bot.pathfinder?.goto) {
              // 使用 pathfinder 移动到目标放置点附近
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore - vec3 没有类型声明
              const Vec3 = (await import('vec3')).default;
              const { goals } = await import('mineflayer-pathfinder');
              const {GoalNear} = goals;

              const placePos = bot.entity.position.offset(1, 0, 0);
              const goal = new GoalNear(placePos.x, placePos.y, placePos.z, 1);
              await bot.pathfinder.goto(goal);
            }

            await bot.equip(craftingTableItem, 'hand');

            // 寻找参照方块放置
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const Vec3 = (await import('vec3')).default;
            const faceVectors = [
              new Vec3(0, 1, 0), new Vec3(0, -1, 0), new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1)
            ];

            let referenceBlock: any = null;
            let faceVector: any = null;
            for (const v of faceVectors) {
              const block = bot.blockAt(bot.entity.position.minus(v));
              if (block && block.name !== 'air') {
                referenceBlock = block;
                faceVector = v;
                break;
              }
            }

            if (referenceBlock && faceVector) {
              await bot.placeBlock(referenceBlock, faceVector);
              // 重新获取工作台方块
              craftingTableBlock = bot.findBlock({
                matching: mcData.blocksByName.crafting_table.id,
                maxDistance: 5
              });
            }
          } catch (placeErr) {
            // 放置失败忽略，继续尝试无工作台配方
            console.warn('放置工作台失败', placeErr);
          }
        }
      }

      // 3) 如果已找到工作台且路径插件可用，走过去
      if (craftingTableBlock && bot.pathfinder?.goto) {
        const { goals } = await import('mineflayer-pathfinder');
        const {GoalNear} = goals;
        const goal = new GoalNear(craftingTableBlock.position.x, craftingTableBlock.position.y, craftingTableBlock.position.z, 1);
        await bot.pathfinder.goto(goal);
      }

      // 4) 拿配方并尝试合成
      const recipe = bot.recipesFor(itemByName.id, null, count, craftingTableBlock ?? null)?.[0];
      if (!recipe) {
        return {
          success: false,
          message: `无法找到 ${params.item} 的合成配方`,
          error: 'RECIPE_NOT_FOUND'
        };
      }

      await bot.craft(recipe, count, craftingTableBlock ?? null);

      return {
        success: true,
        message: `成功合成 ${params.item} × ${count}`,
        data: { item: params.item, count }
      };
    } catch (err) {
      return {
        success: false,
        message: `合成失败: ${err instanceof Error ? err.message : String(err)}`,
        error: 'CRAFT_FAILED'
      };
    }
  }

  validateParams(params: CraftItemParams): boolean {
    return typeof params.item === 'string' && params.item.length > 0;
  }

  getParamsSchema(): Record<string, string> {
    return {
      item: '要合成的物品名称 (字符串)',
      count: '合成数量 (数字，可选，默认为1)'
    };
  }
} 