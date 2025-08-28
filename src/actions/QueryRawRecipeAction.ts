import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult, McpToolSpec } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

interface QueryRawRecipeParams extends BaseActionParams {
  item: string;
  minResultCount?: number; // 最少能生产多少个物品，默认1
  useCraftingTable?: boolean; // 是否使用工作台，默认true
  checkMaterials?: boolean; // 是否检查身上材料是否足够，默认false
}



export class QueryRawRecipeAction extends BaseAction<QueryRawRecipeParams> {
  name = 'queryRawRecipe';
  description = '查询物品的原始合成配方，支持工作台和材料检查选项';
  schema = z.object({
    item: z.string().describe('要查询配方的物品名称 (字符串)'),
    minResultCount: z.number().optional().describe('最少能生产多少个物品，默认1'),
    useCraftingTable: z.boolean().optional().describe('是否使用工作台，默认true'),
    checkMaterials: z.boolean().optional().describe('是否检查身上材料是否足够，默认false')
  });

  /**
   * 获取物品ID对应的名称
   */
  private getItemName(mcData: any, itemId: number): string {
    if (itemId === null || itemId === -1) return 'empty';

    const item = mcData.items[itemId];
    if (!item) return `unknown_item_${itemId}`;

    return item.name || item.displayName || `item_${itemId}`;
  }

  /**
   * 为配方数据添加物品名称
   */
  private enrichRecipeWithNames(mcData: any, recipe: any): any {
    const enrichedRecipe = { ...recipe };

    // 处理result - 支持 RecipeItem 对象或原始对象
    if (enrichedRecipe.result) {
      if (typeof enrichedRecipe.result.id === 'number') {
        // RecipeItem 对象或简单对象
        enrichedRecipe.result = {
          ...enrichedRecipe.result,
          count: enrichedRecipe.result.count ?? 1,
          metadata: enrichedRecipe.result.metadata ?? null,
          name: this.getItemName(mcData, enrichedRecipe.result.id)
        };
      } else if (typeof enrichedRecipe.result === 'number') {
        // 直接是数字ID
        enrichedRecipe.result = {
          id: enrichedRecipe.result,
          count: 1,
          metadata: null,
          name: this.getItemName(mcData, enrichedRecipe.result)
        };
      }
    }

    // 处理inShape（有形状配方）
    if (enrichedRecipe.inShape && Array.isArray(enrichedRecipe.inShape)) {
      enrichedRecipe.inShape = enrichedRecipe.inShape.map((row: any[]) =>
        row.map((item: any) => {
          if (typeof item === 'number' && item !== null && item !== -1) {
            // 原始数字ID
            return {
              id: item,
              count: 1,
              metadata: null,
              name: this.getItemName(mcData, item)
            };
          } else if (item && typeof item.id === 'number') {
            // RecipeItem 对象或简单对象
            return {
              ...item,
              count: item.count ?? 1,
              metadata: item.metadata ?? null,
              name: this.getItemName(mcData, item.id)
            };
          }
          return item;
        })
      );
    }

    // 处理outShape（输出形状）
    if (enrichedRecipe.outShape && Array.isArray(enrichedRecipe.outShape)) {
      enrichedRecipe.outShape = enrichedRecipe.outShape.map((row: any[]) =>
        row.map((item: any) => {
          if (typeof item === 'number' && item !== null && item !== -1) {
            // 原始数字ID
            return {
              id: item,
              count: 1,
              metadata: null,
              name: this.getItemName(mcData, item)
            };
          } else if (item && typeof item.id === 'number') {
            // RecipeItem 对象或简单对象
            return {
              ...item,
              count: item.count ?? 1,
              metadata: item.metadata ?? null,
              name: this.getItemName(mcData, item.id)
            };
          }
          return item;
        })
      );
    }

    // 处理ingredients（无形状配方）
    if (enrichedRecipe.ingredients && Array.isArray(enrichedRecipe.ingredients)) {
      enrichedRecipe.ingredients = enrichedRecipe.ingredients.map((ingredient: any) => {
        if (typeof ingredient === 'number') {
          // 原始数字ID
          return {
            id: ingredient,
            count: 1,
            metadata: null,
            name: this.getItemName(mcData, ingredient)
          };
        } else if (ingredient && typeof ingredient.id === 'number') {
          // RecipeItem 对象或简单对象
          return {
            ...ingredient,
            count: ingredient.count ?? 1,
            metadata: ingredient.metadata ?? null,
            name: this.getItemName(mcData, ingredient.id)
          };
        }
        return ingredient;
      });
    }

    // 处理delta（如果存在）
    if (enrichedRecipe.delta && Array.isArray(enrichedRecipe.delta)) {
      enrichedRecipe.delta = enrichedRecipe.delta.map((item: any) => {
        if (typeof item === 'number') {
          return {
            id: item,
            count: 1,
            metadata: null,
            name: this.getItemName(mcData, item)
          };
        } else if (item && typeof item.id === 'number') {
          return {
            ...item,
            count: item.count ?? 1,
            metadata: item.metadata ?? null,
            name: this.getItemName(mcData, item.id)
          };
        }
        return item;
      });
    }

    return enrichedRecipe;
  }

  async execute(bot: Bot, params: QueryRawRecipeParams): Promise<ActionResult> {
    try {
      this.logger.info(`开始查询物品配方: ${params.item}`);

      // 加载 mcData
      const mcData: any = bot.registry;
      if (!mcData) {
        return this.createErrorResult('mcData 未加载，请检查 mineflayer 版本', 'MCDATA_NOT_LOADED');
      }

      // 统一并宽松解析物品名称
      const normalizeName = (name: string) =>
        name.trim().toLowerCase().replace(/^minecraft:/, '').replace(/\s+/g, '_');

      const requestedRaw = params.item;
      const requested = normalizeName(requestedRaw);

      // 查找物品
      let itemByName = mcData.itemsByName?.[requested];

      // 尝试按显示名匹配
      if (!itemByName && Array.isArray(mcData.itemsArray)) {
        const lower = requestedRaw.trim().toLowerCase();
        itemByName = mcData.itemsArray.find((it: any) => it?.displayName?.toLowerCase() === lower);
      }

      // 尝试方块名匹配
      if (!itemByName && mcData.blocksByName?.[requested]) {
        const asItem = mcData.itemsByName?.[requested];
        if (asItem) itemByName = asItem;
      }

      if (!itemByName) {
        return this.createErrorResult(`未找到名为 ${params.item} 的物品`, 'ITEM_NOT_FOUND');
      }

      // 处理参数
      const minResultCount = params.minResultCount ?? 1;
      const useCraftingTable = params.useCraftingTable ?? true;
      const checkMaterials = params.checkMaterials ?? false;

      // 调用bot的方法查询配方
      let recipes: any[] = [];

      if (checkMaterials) {
        // 检查材料是否足够 - 使用bot.recipesFor
        recipes = bot.recipesFor(itemByName.id, null, minResultCount, useCraftingTable) || [];
      } else {
        // 不检查材料 - 使用bot.recipesAll
        recipes = bot.recipesAll(itemByName.id, null, useCraftingTable) || [];
      }

      if (recipes.length === 0) {
        return this.createErrorResult(`未找到 ${params.item} 的任何合成配方`, 'RECIPE_NOT_FOUND');
      }

      // 为配方添加物品名称信息
      const enrichedRecipes = recipes.map(recipe => this.enrichRecipeWithNames(mcData, recipe));

      return this.createSuccessResult(`找到 ${params.item} 的合成配方`, enrichedRecipes);
    } catch (error) {
      return this.createExceptionResult(error, '查询配方失败', 'QUERY_FAILED');
    }
  }

}
