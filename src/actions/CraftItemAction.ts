import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';

interface CraftItemParams extends BaseActionParams {
  item: string;
  count?: number;
  preferredMaterials?: string[];
}

export class CraftItemAction extends BaseAction<CraftItemParams> {
  name = 'craftItem';
  description = '合成指定物品';
  schema = z.object({
    item: z.string().describe('要合成的物品名称 (字符串)'),
    count: z.number().int().min(1).optional().describe('合成数量 (数字，可选，默认为1)'),
    preferredMaterials: z.array(z.string()).optional().describe('偏好的材料列表，按优先级排序 (字符串数组，可选)'),
  });

  // 校验与参数描述由基类通过 schema 自动提供

  /**
   * 分析配方中使用的材料
   */
  private analyzeRecipeMaterials(mcData: any, recipe: any): string[] {
    const materials: string[] = [];
    
    if ('inShape' in recipe) {
      // ShapedRecipe
      const shapedRecipe = recipe as any;
      const shape = shapedRecipe.inShape ?? [];
      for (const row of shape) {
        for (const item of row) {
          if (item !== null) {
            const itemName = this.getItemName(mcData, item);
            if (itemName !== 'empty' && !materials.includes(itemName)) {
              materials.push(itemName);
            }
          }
        }
      }
    } else {
      // ShapelessRecipe
      const shapelessRecipe = recipe as any;
      const ingredientsList = shapelessRecipe.ingredients ?? [];
      for (const item of ingredientsList) {
        const itemName = this.getItemName(mcData, item);
        if (itemName !== 'empty' && !materials.includes(itemName)) {
          materials.push(itemName);
        }
      }
    }
    
    return materials;
  }

  /**
   * 获取物品名称
   */
  private getItemName(mcData: any, item: any): string {
    if (!item) return 'empty';
    
    // 如果是数字ID，查找对应的物品
    if (typeof item === 'number') {
      const itemData = mcData.items[item];
      return itemData ? itemData.name : 'unknown';
    }
    
    // 如果已经是物品对象
    if (item.id !== undefined) {
      const itemData = mcData.items[item.id];
      return itemData ? itemData.name : 'unknown';
    }
    
    return 'unknown';
  }

  /**
   * 根据用户偏好对配方进行排序
   */
  private sortRecipesByPreference(mcData: any, recipes: any[], preferredMaterials: string[]): any[] {
    if (!preferredMaterials || preferredMaterials.length === 0) {
      return recipes;
    }

    return recipes.sort((a, b) => {
      const materialsA = this.analyzeRecipeMaterials(mcData, a);
      const materialsB = this.analyzeRecipeMaterials(mcData, b);
      
      // 计算每个配方中偏好材料的最高优先级
      const scoreA = this.calculatePreferenceScore(materialsA, preferredMaterials);
      const scoreB = this.calculatePreferenceScore(materialsB, preferredMaterials);
      
      // 分数越高优先级越高（降序排列）
      return scoreB - scoreA;
    });
  }

  /**
   * 计算配方中偏好材料的优先级分数
   */
  private calculatePreferenceScore(materials: string[], preferredMaterials: string[]): number {
    let score = 0;
    
    for (let i = 0; i < preferredMaterials.length; i++) {
      const preferred = preferredMaterials[i].toLowerCase().replace(/\s+/g, '_');
      if (materials.some(material => material.toLowerCase().includes(preferred))) {
        // 优先级越高分数越高（第一个偏好材料得分最高）
        score += preferredMaterials.length - i;
      }
    }
    
    return score;
  }

  async execute(bot: Bot, params: CraftItemParams): Promise<ActionResult> {
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

      // 4) 获取所有配方并尝试合成
      const allRecipes = bot.recipesAll(itemByName.id, null, craftingTableBlock ?? null);
      if (!allRecipes || allRecipes.length === 0) {
        return this.createErrorResult(`无法找到 ${params.item} 的合成配方`, 'RECIPE_NOT_FOUND');
      }
      
      // 根据用户偏好对配方进行排序
      const sortedRecipes = this.sortRecipesByPreference(mcData, allRecipes, params.preferredMaterials || []);
      
      // 优先尝试有足够材料的配方（按偏好排序）
      const availableRecipes = bot.recipesFor(itemByName.id, null, count, craftingTableBlock ?? null);
      const sortedAvailableRecipes = this.sortRecipesByPreference(mcData, availableRecipes, params.preferredMaterials || []);
      
      // 记录偏好材料信息
      if (params.preferredMaterials && params.preferredMaterials.length > 0) {
        this.logger.info(`用户偏好材料: ${params.preferredMaterials.join(', ')}`);
      }
      
      let recipe = null;
      
      // 先尝试有足够材料的配方（按偏好排序）
      for (const potentialRecipe of sortedAvailableRecipes) {
        try {
          await bot.craft(potentialRecipe, count, craftingTableBlock ?? null);
          recipe = potentialRecipe;
          break;
        } catch (craftErr) {
          this.logger.debug(`可用配方合成失败，尝试下一个`);
          continue;
        }
      }
      
      // 如果没有可用配方或可用配方都失败了，尝试所有配方（按偏好排序）
      if (!recipe) {
        for (const potentialRecipe of sortedRecipes) {
          try {
            await bot.craft(potentialRecipe, count, craftingTableBlock ?? null);
            recipe = potentialRecipe;
            break;
          } catch (craftErr) {
            this.logger.debug(`配方材料不足，尝试下一个配方`);
            continue;
          }
        }
      }
      
      // 如果所有配方都尝试过了还是不行，返回材料不足错误
      if (!recipe) {
        return this.createErrorResult("背包里的合成材料不足", 'NO_ENOUGH_INGREDIENTS');
      }

      this.logger.info(`成功合成 ${params.item} × ${count}`);
      return this.createSuccessResult(`成功合成 ${params.item} × ${count}`, { item: params.item, count });
    } catch (err) {
      this.logger.error(`合成失败: ${err instanceof Error ? err.message : String(err)}`);
      return this.createExceptionResult(err, `合成失败`, 'CRAFT_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: craft_item）
} 