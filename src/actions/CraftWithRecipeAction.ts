import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder-mai';
import { Recipe } from 'prismarine-recipe';
import { GoalType, MovementUtils } from '../utils/MovementUtils.js';

interface CraftWithRecipeParams extends BaseActionParams {
  /**
   * 配方对象，直接传入bot.craft的第一个参数
   *
   * 配方对象结构（基于prismarine-recipe库）：
   * {
   *   result: RecipeItem,                    // 合成结果
   *   inShape: RecipeItem[][],              // 输入形状（有序配方）
   *   outShape: RecipeItem[][],             // 输出形状
   *   ingredients: RecipeItem[],            // 配方材料（无序配方）
   *   delta: RecipeItem[],                  // 材料变化
   *   requiresTable: boolean                // 是否需要工作台
   * }
   *
   * RecipeItem结构：
   * {
   *   id: number,                           // 物品ID
   *   metadata: number | null,              // 元数据（可为null）
   *   count: number                         // 物品数量
   * }
   *
   * 使用示例：
   * {
   *   result: { id: 5, metadata: null, count: 4 },           // 合成结果：4个木板
   *   inShape: [                                              // 有序配方：2x2的原木排列
   *     [{ id: 17, metadata: null, count: 1 }, { id: 17, metadata: null, count: 1 }],
   *     [{ id: 17, metadata: null, count: 1 }, { id: 17, metadata: null, count: 1 }]
   *   ],
   *   ingredients: [                                          // 无序配方：所需材料列表
   *     { id: 17, metadata: null, count: 4 }
   *   ],
   *   requiresTable: false                                    // 是否需要工作台
   * }
   */
  recipe: Recipe;
  count?: number;
  withoutCraftingTable?: boolean;
}

export class CraftWithRecipeAction extends BaseAction<CraftWithRecipeParams> {
  name = 'craftWithRecipe';
  description = '使用指定的配方合成物品';
  schema = z.object({
    recipe: z.any().describe(`配方对象，直接传入bot.craft的第一个参数
结构说明：
- result: RecipeItem - 合成结果
- inShape?: RecipeItem[][] - 输入形状（有序配方）
- outShape?: RecipeItem[][] - 输出形状
- ingredients?: RecipeItem[] - 配方材料（无序配方）
- delta?: RecipeItem[] - 合成前后材料变化
- requiresTable: boolean - 是否需要工作台
RecipeItem结构：{ id: number, metadata: number|null, count: number }`),
    count: z.number().int().min(1).optional().describe('合成数量 (数字，可选，默认为1)'),
    withoutCraftingTable: z.boolean().optional().describe('是否强制不使用工作台 (布尔值，可选，默认false)'),
  });

  async execute(bot: Bot, params: CraftWithRecipeParams): Promise<ActionResult> {
    try {
      this.logger.info(`开始使用指定配方合成物品, 数量: ${params.count ?? 1}`);
      const count = params.count ?? 1;

      // 加载 mcData，优先使用 mineflayer 官方推荐的 bot.registry（与服务器版本精确匹配）
      const mcData: any = bot.registry;

      // 1) 根据 withoutCraftingTable 参数决定是否使用工作台
      let craftingTableBlock: any = null;

      if (!params.withoutCraftingTable) {
        // 尝试寻找附近工作台
        craftingTableBlock = bot.findBlock({
          matching: mcData.blocksByName.crafting_table.id,
          maxDistance: 48
        });

        // 2) 判断配方是否需要工作台
        const recipeRequiresTable = params.recipe?.requiresTable ?? false;

        // 若未找到工作台且必须使用工作台
        if (!craftingTableBlock && recipeRequiresTable) {
          // 检查背包是否有工作台
          const craftingTableItem = bot.inventory.findInventoryItem(mcData.itemsByName.crafting_table.id, null, false);

          if (craftingTableItem) {
            try {
              // 尝试放置工作台
              // 使用统一的移动工具类移动到目标放置点附近
              const placePos = bot.entity.position.offset(1, 0, 0);
              const moveResult = await MovementUtils.moveToCoordinate(bot, placePos.x, placePos.y, placePos.z, 1, 32, false);
              if (!moveResult.success) {
                this.logger.warn(`移动到工作台放置点失败: ${moveResult.error}，尝试直接放置`);
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
      } else {
        this.logger.info('用户指定不使用工作台进行合成');
      }

      // 3) 如果已找到工作台，走过去（仅在未指定 withoutCraftingTable 时）
      if (!params.withoutCraftingTable && craftingTableBlock) {
        // 使用统一的移动工具类移动到工作台位置
        const moveResult = await MovementUtils.moveTo(
          bot,
          {
            type: 'coordinate',
            x: craftingTableBlock.position.x,
            y: craftingTableBlock.position.y,
            z: craftingTableBlock.position.z,
            distance: 1, // 到达距离
            maxDistance: 32, // 最大移动距离
            useRelativeCoords: false, // 不使用相对坐标
            goalType: GoalType.GoalGetToBlock, // 使用获取方块目标类型
          }
        );

        if (!moveResult.success) {
          this.logger.warn(`移动到工作台失败: ${moveResult.error}，尝试直接合成`);
        }
      }

      // 4) 使用指定的配方进行合成
      try {
        await bot.craft(params.recipe, count, craftingTableBlock ?? undefined);

        // 获取合成结果物品信息
        const resultItem = params.recipe?.result;
        let itemName = '未知物品';
        if (resultItem) {
          const itemData = mcData.items[resultItem.id];
          if (itemData) {
            itemName = itemData.name;
          }
        }

        this.logger.info(`成功使用指定配方合成 ${itemName} × ${count}`);
        return this.createSuccessResult(`成功使用指定配方合成 ${itemName} × ${count}`, {
          item: itemName,
          count,
        });
      } catch (craftErr) {
        this.logger.error(`使用指定配方合成失败: ${craftErr instanceof Error ? craftErr.message : String(craftErr)}`);

        // 如果是工作台相关错误且用户指定了不使用工作台，尝试不使用工作台再次合成
        if (!params.withoutCraftingTable && params.recipe?.requiresTable === false) {
          try {
            await bot.craft(params.recipe, count, undefined);
            const resultItem = params.recipe?.result;
            let itemName = '未知物品';
            if (resultItem) {
              const itemData = mcData.items[resultItem.id];
              if (itemData) {
                itemName = itemData.name;
              }
            }

            this.logger.info(`成功使用指定配方合成 ${itemName} × ${count} (不使用工作台)`);
            return this.createSuccessResult(`成功使用指定配方合成 ${itemName} × ${count} (不使用工作台)`, {
              item: itemName,
              count,
            });
          } catch (retryErr) {
            return this.createErrorResult(`合成失败: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`, 'CRAFT_FAILED');
          }
        }

        return this.createErrorResult(`合成失败: ${craftErr instanceof Error ? craftErr.message : String(craftErr)}`, 'CRAFT_FAILED');
      }
    } catch (err) {
      this.logger.error(`合成失败: ${err instanceof Error ? err.message : String(err)}`);
      return this.createExceptionResult(err, `合成失败`, 'CRAFT_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: craft_with_recipe）
}
