import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Recipe, RecipeItem } from 'minecraft-data';

interface QueryRecipeParams extends BaseActionParams {
  item: string;
}

// 简化的配方格式，包含工作台需求标记
type SimplifiedRecipe = {
  ingredients: Array<{
    name: string;
    count: number;
  }>;
  requiresCraftingTable: boolean;
};

export class QueryRecipeAction extends BaseAction<QueryRecipeParams> {
  name = 'queryRecipe';
  description = '查询指定物品的合成配方所需的材料及数量，返回数组中每一组材料都可以合成目标物品';
  schema = z.object({
    item: z.string().describe('要查询配方的物品名称 (字符串)'),
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
  private convertRecipeToSimplified(mcData: any, recipe: any, requiresCraftingTable: boolean): SimplifiedRecipe {
    let ingredients: { [name: string]: number } = {};
    
    if ('inShape' in recipe) {
      // ShapedRecipe
      const shapedRecipe = recipe as any;
      
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
    } else {
      // ShapelessRecipe
      const shapelessRecipe = recipe as any;
      
      // 统计无形状配方中的物品数量
      const ingredientsList = shapelessRecipe.ingredients ?? [];
      for (const item of ingredientsList) {
        const itemName = this.getItemName(mcData, item);
        if (itemName !== 'empty') {
          ingredients[itemName] = (ingredients[itemName] || 0) + 1;
        }
      }
    }
    
    return {
      ingredients: Object.entries(ingredients).map(([name, count]) => ({ name, count })),
      requiresCraftingTable
    };
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

      // 查询所有配方（包括需要工作台和不需要工作台的）
      const recipesWithoutTable = bot.recipesAll(itemByName.id, null, false) || [];
      const recipesWithTable = bot.recipesAll(itemByName.id, null, true) || [];
      
      const allRecipes: SimplifiedRecipe[] = [];
      
      // 添加不需要工作台的配方
      recipesWithoutTable.forEach(recipe => {
        allRecipes.push(this.convertRecipeToSimplified(mcData, recipe, false));
      });
      
      // 添加需要工作台的配方
      recipesWithTable.forEach(recipe => {
        allRecipes.push(this.convertRecipeToSimplified(mcData, recipe, true));
      });

      if (allRecipes.length === 0) {
        return this.createErrorResult(`未找到 ${params.item} 的任何合成配方`, 'RECIPE_NOT_FOUND');
      }

      // 去重配方（基于材料组合和工作台需求）
      const uniqueRecipes = this.removeDuplicateRecipes(allRecipes);

      return this.createSuccessResult(`找到 ${params.item} 的合成配方:`, {
        recipes: uniqueRecipes,
        summary: {
          total: uniqueRecipes.length,
          withoutTable: uniqueRecipes.filter(r => !r.requiresCraftingTable).length,
          withTable: uniqueRecipes.filter(r => r.requiresCraftingTable).length
        },
        tips: '不同材质的物品一般也能用同样的方法合成，例如不同材质木板都可以合成木棍'
      });
    } catch (error) {
      return this.createExceptionResult(error, '查询配方失败', 'QUERY_FAILED');
    }
  }

  /**
   * 去除重复的配方
   * 当配料和数量完全一致时，优先保留不需要工作台的配方
   */
  private removeDuplicateRecipes(recipes: SimplifiedRecipe[]): SimplifiedRecipe[] {
    // 先按材料组合分组
    const recipeGroups = new Map<string, SimplifiedRecipe[]>();
    
    for (const recipe of recipes) {
      // 创建配方的唯一标识（仅基于材料排序，不包含工作台需求）
      const ingredientsKey = recipe.ingredients
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(ing => `${ing.name}:${ing.count}`)
        .join(',');
      
      if (!recipeGroups.has(ingredientsKey)) {
        recipeGroups.set(ingredientsKey, []);
      }
      recipeGroups.get(ingredientsKey)!.push(recipe);
    }
    
    // 对每个材料组合，优先选择不需要工作台的配方
    const uniqueRecipes: SimplifiedRecipe[] = [];
    
    for (const [ingredientsKey, groupRecipes] of recipeGroups) {
      // 找到不需要工作台的配方
      const withoutTable = groupRecipes.find(r => !r.requiresCraftingTable);
      // 如果存在不需要工作台的配方，优先使用它
      if (withoutTable) {
        uniqueRecipes.push(withoutTable);
      } else {
        // 如果不存在不需要工作台的配方，使用第一个（通常是需要工作台的）
        uniqueRecipes.push(groupRecipes[0]);
      }
    }
    
    return uniqueRecipes;
  }
}
