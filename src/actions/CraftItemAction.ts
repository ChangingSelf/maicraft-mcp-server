import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';

interface CraftItemParams extends BaseActionParams {
  item: string;
  count?: number;
}

export class CraftItemAction extends BaseAction<CraftItemParams> {
  name = 'craftItem';
  description = '合成指定物品';
  schema = z.object({
    item: z.string().describe('要合成的物品名称 (字符串)'),
    count: z.number().int().min(1).optional().describe('合成数量 (数字，可选，默认为1)'),
  });

  // 校验与参数描述由基类通过 schema 自动提供

  async execute(bot: Bot, params: CraftItemParams): Promise<any> {
    try {
      this.logger.info(`开始合成物品: ${params.item}, 数量: ${params.count ?? 1}`);
      const count = params.count ?? 1;

      // 加载 mcData，优先使用 mineflayer 官方推荐的 bot.registry（与服务器版本精确匹配）
      const mcData: any = bot.registry;

      // 统一并宽松解析物品名称：
      // - 去掉前缀 minecraft:
      // - 转小写
      // - 空格转下划线
      const normalizeName = (name: string) =>
        name.trim().toLowerCase().replace(/^minecraft:/, '').replace(/\s+/g, '_');

      const requestedRaw = params.item;
      const requested = normalizeName(requestedRaw);

      // 1) 按键名直接查找（itemsByName 使用下划线小写键，如 chest、crafting_table）
      let itemByName = mcData.itemsByName?.[requested];

      // 2) 若失败，尝试按显示名匹配（例如传入 "Chest"）
      if (!itemByName && Array.isArray(mcData.itemsArray)) {
        const lower = requestedRaw.trim().toLowerCase();
        itemByName = mcData.itemsArray.find((it: any) => it?.displayName?.toLowerCase() === lower);
      }

      // 3) 若仍失败，最后尝试：如果以方块名能找到，则用同名物品再查一次
      if (!itemByName && mcData.blocksByName?.[requested]) {
        const asItem = mcData.itemsByName?.[requested];
        if (asItem) itemByName = asItem;
      }

      if (!itemByName) {
        this.logger.error(`未找到名为 ${params.item} 的物品`);
        return this.createErrorResult(`未找到名为 ${params.item} 的物品`, 'ITEM_NOT_FOUND');
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
              const {GoalNear} = pathfinder.goals;
              if (!GoalNear) {
                return this.createErrorResult('mineflayer-pathfinder goals 未加载', 'PATHFINDER_NOT_LOADED');
              }

              const placePos = bot.entity.position.offset(1, 0, 0);
              const goal = new GoalNear(placePos.x, placePos.y, placePos.z, 1);
              await bot.pathfinder.goto(goal);
            }

            await bot.equip(craftingTableItem, 'hand');

            // 寻找参照方块放置
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
            this.logger.warn('放置工作台失败', placeErr);
          }
        }
      }

      // 3) 如果已找到工作台且路径插件可用，走过去
      if (craftingTableBlock && bot.pathfinder?.goto) {
        const { GoalNear } = pathfinder.goals;
        if (!GoalNear) {
          return this.createErrorResult('mineflayer-pathfinder goals 未加载', 'PATHFINDER_NOT_LOADED');
        }
        const goal = new GoalNear(craftingTableBlock.position.x, craftingTableBlock.position.y, craftingTableBlock.position.z, 1);
        await bot.pathfinder.goto(goal);
      }

      // 4) 拿配方并尝试合成
      const recipe = bot.recipesFor(itemByName.id, null, count, craftingTableBlock ?? null)?.[0];
      if (!recipe) {
        return this.createErrorResult(`无法找到 ${params.item} 的合成配方或者背包里的合成材料不足`, 'RECIPE_NOT_FOUND');
      }

      await bot.craft(recipe, count, craftingTableBlock ?? null);

      this.logger.info(`成功合成 ${params.item} × ${count}`);
      return this.createSuccessResult(`成功合成 ${params.item} × ${count}`, { item: params.item, count });
    } catch (err) {
      this.logger.error(`合成失败: ${err instanceof Error ? err.message : String(err)}`);
      return this.createExceptionResult(err, `合成失败`, 'CRAFT_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: craft_item）
} 