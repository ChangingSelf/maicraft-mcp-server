import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Recipe, RecipeItem } from 'minecraft-data';

interface QueryRecipeParams extends BaseActionParams {
  item: string;
  useCraftingTable: boolean;
}

// 简化的配方格式，直接是材料数组
type SimplifiedRecipe = Array<{
  name: string;
  count: number;
}>;

export class QueryRecipeAction extends BaseAction<QueryRecipeParams> {
  name = 'queryRecipe';
  description = '查询指定物品的合成配方所需的材料及数量，返回数组中每一组材料都可以合成目标物品';
  schema = z.object({
    item: z.string().describe('要查询配方的物品名称 (字符串)'),
    useCraftingTable: z.boolean().optional().describe('是否使用合成台 (布尔值，可选，默认false)'),
  });

  /**
   * 将 RecipeItem 转换为物品名称
   */
  private getItemName(mcData: any, recipeItem: any): string {
    if (Array.isArray(recipeItem)) {
      const [id, metadata] = recipeItem;
      if (id === null || id === -1) return 'empty';
      
      const item = mcData.items[id];
      if (!item) return `unknown_item_${id}`;
      
      // 如果有 metadata，尝试找到对应的变体
      if (metadata !== undefined && item.variations) {
        const variation = item.variations.find((v: any) => v.metadata === metadata);
        if (variation) return variation.name;
      }
      
      return item.name || item.displayName;
    } else if (typeof recipeItem === 'object' && recipeItem !== null) {
      if (recipeItem.id === null || recipeItem.id === -1) return 'empty';
      
      const item = mcData.items[recipeItem.id];
      if (!item) return `unknown_item_${recipeItem.id}`;
      
      // 如果有 metadata，尝试找到对应的变体
      if (recipeItem.metadata !== undefined && recipeItem.metadata !== null && item.variations) {
        const variation = item.variations.find((v: any) => v.metadata === recipeItem.metadata);
        if (variation) return variation.name;
      }
      
      return item.name || item.displayName;
    } else if (typeof recipeItem === 'number') {
      if (recipeItem === -1) return 'empty';
      
      const item = mcData.items[recipeItem];
      if (!item) return `unknown_item_${recipeItem}`;
      return item.name || item.displayName;
    }
    
    return 'empty';
  }

  /**
   * 将原始配方转换为简化格式
   */
  private convertRecipeToSimplified(mcData: any, recipe: any): SimplifiedRecipe {
    if ('inShape' in recipe) {
      // ShapedRecipe
      const shapedRecipe = recipe as any;
      const ingredients: { [name: string]: number } = {};
      
      // 统计形状中的物品数量
      const shape = shapedRecipe.inShape ?? [];
      for (const row of shape) {
        for (const item of row) {
          if (item !== null) {
            const itemName = this.getItemName(mcData, item);
            if (itemName !== 'empty') {
              ingredients[itemName] = (ingredients[itemName] || 0) + 1;
            }
          }
        }
      }
      
      return Object.entries(ingredients).map(([name, count]) => ({ name, count }));
    } else {
      // ShapelessRecipe
      const shapelessRecipe = recipe as any;
      const ingredients: { [name: string]: number } = {};
      
      // 统计无形状配方中的物品数量
      const ingredientsList = shapelessRecipe.ingredients ?? [];
      for (const item of ingredientsList) {
        const itemName = this.getItemName(mcData, item);
        if (itemName !== 'empty') {
          ingredients[itemName] = (ingredients[itemName] || 0) + 1;
        }
      }
      
      return Object.entries(ingredients).map(([name, count]) => ({ name, count }));
    }
  }

  async execute(bot: Bot, params: QueryRecipeParams): Promise<ActionResult> {
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

      // 查询配方
      const recipes = bot.recipesAll(itemByName.id, null, params.useCraftingTable ?? false);
      
      if (!recipes || recipes.length === 0) {
        return this.createErrorResult(`未找到 ${params.item} 在${(params.useCraftingTable??false) ? '使用工作台时' : '不使用工作台时'}的合成配方`, 'RECIPE_NOT_FOUND');
      }

      // 转换配方为简化格式
      const simplifiedRecipes = recipes.map(recipe => this.convertRecipeToSimplified(mcData, recipe));
      return this.createSuccessResult(`找到 ${params.item} 的合成配方:`, {
        recipes: simplifiedRecipes,
        tips: '不同材质的物品一般也能用同样的方法合成，例如不同材质木板都可以合成木棍'
      });
    } catch (error) {
      return this.createExceptionResult(error, '查询配方失败', 'QUERY_FAILED');
    }
  }
}
