import { Bot } from 'mineflayer';
import minecraftData, { Item } from 'minecraft-data';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

/**
 * 判断物品是否为食物
 * @param itemName 物品名称
 * @param mcData minecraft-data 实例
 * @returns 是否为食物
 */
function isFoodItem(itemName: string, mcData: minecraftData.IndexedData): boolean {
  // 方法1：通过 foodsByName 检查
  if (mcData.foodsByName && mcData.foodsByName[itemName]) {
    return true;
  }

  // 方法2：通过物品ID在foods中查找
  if (mcData.itemsByName && mcData.foods) {
    const itemMeta = mcData.itemsByName[itemName];
    if (itemMeta && mcData.foods[itemMeta.id]) {
      return true;
    }
  }

  return false;
}

interface UseItemParams extends BaseActionParams {
  /** 物品名称，可选，不指定则使用当前手持物品 */
  itemName?: string;
  /** 使用类型：consume（食用）, activate（激活）, useOn（对实体使用） */
  useType?: 'consume' | 'activate' | 'useOn';
  /** 目标实体名称，仅在使用 useOn 类型时需要 */
  targetEntityName?: string;
  /** 目标玩家名称，仅在使用 useOn 类型时需要 */
  targetPlayerName?: string;
  /** 是否使用副手，默认为主手 */
  offHand?: boolean;
}

export class UseItemAction extends BaseAction<UseItemParams> {
  name = 'useItem';
  description = '使用手中物品，或切换到指定物品并使用，支持食用、激活、对实体使用等操作';
  schema = z.object({
    itemName: z.string().optional().describe('物品名称，可选，不指定则使用当前手持物品'),
    useType: z.enum(['consume', 'activate', 'useOn']).optional().describe('使用类型：consume（食用）, activate（激活）, useOn（对实体使用，例如剪羊毛，装备鞍，喂羊等），默认为根据物品类型自动判断'),
    targetEntityName: z.string().optional().describe('目标实体名称，仅在使用 useOn 类型时需要'),
    targetPlayerName: z.string().optional().describe('目标玩家名称，仅在使用 useOn 类型时需要'),
    offHand: z.boolean().optional().describe('是否使用副手，默认为主手')
  });

  /**
   * 执行使用物品操作
   */
  async execute(bot: Bot, params: UseItemParams): Promise<ActionResult> {
    try {
      this.logger.info(`开始使用物品操作: ${JSON.stringify(params)}`);

      // 验证参数
      const validationResult = this.validateUseItemParams(bot, params);
      if (!validationResult.valid) {
        return this.createErrorResult(validationResult.message || '参数验证失败', 'VALIDATION_FAILED');
      }

      // 获取 Minecraft 数据
      const mcData = minecraftData(bot.version);

      // 获取要使用的物品
      const itemToUse = await this.getItemToUse(bot, params, mcData);
      if (!itemToUse) {
        return this.createErrorResult('未找到指定的物品', 'ITEM_NOT_FOUND');
      }

      // 确定使用类型
      const useType = params.useType || this.determineUseType(itemToUse, mcData);

      // 验证物品是否可以进行指定的操作
      const canUseResult = this.canItemBeUsed(itemToUse, useType, mcData);
      if (!canUseResult.canUse) {
        return this.createErrorResult(canUseResult.message || '物品无法进行此操作', 'ITEM_CANNOT_BE_USED');
      }

      // 执行相应的使用操作
      switch (useType) {
        case 'consume':
          return await this.consumeItem(bot, itemToUse);
        case 'activate':
          return await this.activateItem(bot, params.offHand || false);
        case 'useOn':
          return await this.useItemOnEntity(bot, params.targetEntityName, params.targetPlayerName);
        default:
          return this.createErrorResult('不支持的使用类型', 'UNSUPPORTED_USE_TYPE');
      }

    } catch (error) {
      this.logger.error(`使用物品失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '使用物品失败', 'USE_ITEM_FAILED');
    }
  }

  /**
   * 获取要使用的物品
   */
  private async getItemToUse(bot: Bot, params: UseItemParams, mcData: any): Promise<any> {
    // 如果指定了物品名称，查找并切换到该物品
    if (params.itemName) {
      const itemMeta = mcData.itemsByName[params.itemName];
      if (!itemMeta) {
        throw new Error(`未知物品: ${params.itemName}`);
      }

      // 在背包中查找该物品
      const itemInInventory = bot.inventory.items().find(item => item.type === itemMeta.id);
      if (!itemInInventory) {
        throw new Error(`背包中没有找到物品: ${params.itemName}`);
      }

      // 如果当前手持的不是目标物品，切换到该物品
      if (!bot.heldItem || bot.heldItem.type !== itemMeta.id) {
        await bot.equip(itemMeta.id, 'hand');
        this.logger.info(`切换到物品: ${params.itemName}`);
      }

      return itemInInventory;
    }

    // 使用当前手持物品
    if (!bot.heldItem) {
      throw new Error('当前没有手持物品');
    }

    return bot.heldItem;
  }

  /**
   * 根据物品类型自动确定使用方式
   */
  private determineUseType(item: any, mcData: any): 'consume' | 'activate' | 'useOn' {
    // 首先检查是否是食物
    if (isFoodItem(item.name, mcData)) {
      return 'consume';
    }

    // 可投掷的物品（雪球、鸡蛋、末影珍珠等）
    const throwableItems = ['snowball', 'egg', 'ender_pearl'];
    if (throwableItems.includes(item.name)) {
      return 'activate';
    }

    // 默认激活（弓箭、烟花等）
    return 'activate';
  }

  /**
   * 获取背包中指定物品的总数量
   */
  private getTotalItemCount(bot: Bot, itemName: string): number {
    let totalCount = 0;

    // 遍历所有背包槽位
    for (const slot of bot.inventory.items()) {
      if (slot.name === itemName) {
        totalCount += slot.count;
      }
    }

    return totalCount;
  }

  /**
   * 等待物品更新
   */
  private async waitForItemUpdate(delayMs: number = 500): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * 食用物品
   */
  private async consumeItem(bot: Bot, item: any): Promise<ActionResult> {
    this.logger.info(`开始食用物品: ${item.name}`);

    // 获取使用前的总数量
    const totalCountBefore = this.getTotalItemCount(bot, item.name);

    try {
      await bot.consume();
      this.logger.info(`成功食用物品: ${item.name}`);

      // 等待500ms让物品数量更新
      await this.waitForItemUpdate(500);

      // 获取使用后的总数量
      const totalCountAfter = this.getTotalItemCount(bot, item.name);

      return this.createSuccessResult(
        `成功食用物品: ${item.name}`,
        {
          itemName: item.name,
          useType: 'consume',
          itemCountBefore: totalCountBefore,
          itemCountAfter: totalCountAfter,
          itemCount: totalCountAfter // 兼容性：主要返回使用后的数量
        }
      );
    } catch (error) {
      return this.createErrorResult(
        `食用物品失败: ${item.name}, ${error instanceof Error ? error.message : String(error)}`,
        'CONSUME_FAILED'
      );
    }
  }

  /**
   * 激活物品
   */
  private async activateItem(bot: Bot, offHand: boolean): Promise<ActionResult> {
    const item = offHand ? bot.inventory.slots[45] : bot.heldItem; // 45 是副手槽位
    if (!item) {
      return this.createErrorResult('没有找到要激活的物品', 'NO_ITEM_TO_ACTIVATE');
    }

    this.logger.info(`开始激活物品: ${item.name}, 使用${offHand ? '副手' : '主手'}`);

    // 获取使用前的总数量
    const totalCountBefore = this.getTotalItemCount(bot, item.name);

    try {
      await bot.activateItem(offHand);
      this.logger.info(`成功激活物品: ${item.name}`);

      // 等待500ms让物品数量更新
      await this.waitForItemUpdate(500);

      // 获取使用后的总数量
      const totalCountAfter = this.getTotalItemCount(bot, item.name);

      return this.createSuccessResult(
        `成功激活物品: ${item.name}`,
        {
          itemName: item.name,
          useType: 'activate',
          offHand,
          itemCountBefore: totalCountBefore,
          itemCountAfter: totalCountAfter,
          itemCount: totalCountAfter // 兼容性：主要返回使用后的数量
        }
      );
    } catch (error) {
      return this.createErrorResult(
        `激活物品失败: ${item.name}, ${error instanceof Error ? error.message : String(error)}`,
        'ACTIVATE_FAILED'
      );
    }
  }

  /**
   * 对实体使用物品
   */
  private async useItemOnEntity(bot: Bot, targetEntityName?: string, targetPlayerName?: string): Promise<ActionResult> {
    if (!bot.heldItem) {
      return this.createErrorResult('没有手持物品', 'NO_ITEM_HELD');
    }

    let targetEntity = null;

    // 如果指定了玩家名称，查找该玩家
    if (targetPlayerName) {
      const player = bot.players[targetPlayerName];
      if (player && player.entity) {
        targetEntity = player.entity;
      } else {
        return this.createErrorResult(`未找到目标玩家: ${targetPlayerName}`, 'PLAYER_NOT_FOUND');
      }
    }
    // 如果指定了实体名称，查找该类型的实体
    else if (targetEntityName) {
      // 首先查找最近的匹配实体
      const nearestEntity = bot.nearestEntity((entity) => {
        return entity.name === targetEntityName ||
               entity.type === targetEntityName ||
               entity.displayName === targetEntityName;
      });

      if (nearestEntity) {
        targetEntity = nearestEntity;
      } else {
        return this.createErrorResult(`未找到目标实体: ${targetEntityName}`, 'ENTITY_NOT_FOUND');
      }
    }
    // 如果都没有指定，查找最近的实体
    else {
      const nearestEntity = bot.nearestEntity();
      if (!nearestEntity) {
        return this.createErrorResult('附近没有找到实体', 'NO_ENTITY_NEARBY');
      }
      targetEntity = nearestEntity;
    }

    const targetDescription = targetPlayerName || targetEntityName || targetEntity.name || targetEntity.id;
    this.logger.info(`开始对实体使用物品: ${bot.heldItem.name} -> ${targetDescription}`);

    try {
      // 获取使用前的总数量
      const totalCountBefore = this.getTotalItemCount(bot, bot.heldItem.name);

      await bot.useOn(targetEntity);
      this.logger.info(`成功对实体使用物品: ${bot.heldItem.name}`);

      // 等待500ms让物品数量更新
      await this.waitForItemUpdate(500);

      // 获取使用后的总数量
      const totalCountAfter = this.getTotalItemCount(bot, bot.heldItem.name);

      return this.createSuccessResult(
        `成功对实体使用物品: ${bot.heldItem.name}`,
        {
          itemName: bot.heldItem.name,
          useType: 'useOn',
          targetEntityId: targetEntity.id,
          targetEntityName: targetEntity.name,
          targetPlayerName,
          targetEntityType: targetEntity.type,
          itemCountBefore: totalCountBefore,
          itemCountAfter: totalCountAfter,
          itemCount: totalCountAfter // 兼容性：主要返回使用后的数量
        }
      );
    } catch (error) {
      return this.createErrorResult(
        `对实体使用物品失败: ${error instanceof Error ? error.message : String(error)}`,
        'USE_ON_FAILED'
      );
    }
  }

  /**
   * 验证使用物品的参数
   */
  private validateUseItemParams(bot: Bot, params: UseItemParams): { valid: boolean; message?: string } {
    // 如果指定了使用类型为 useOn，必须提供目标实体名称或玩家名称
    if (params.useType === 'useOn') {
      if (!params.targetEntityName && !params.targetPlayerName) {
        // 查找最近的实体
        const nearestEntity = bot.nearestEntity();
        if (!nearestEntity) {
          return { valid: false, message: '使用类型为 useOn 时必须指定目标实体名称或玩家名称，或附近有可用实体' };
        }
      }
    }

    // 如果同时指定了实体名称和玩家名称，返回错误
    if (params.targetEntityName && params.targetPlayerName) {
      return { valid: false, message: '不能同时指定目标实体名称和玩家名称，请选择其中一个' };
    }

    // 如果指定了物品名称，验证物品名称格式
    if (params.itemName) {
      if (typeof params.itemName !== 'string' || params.itemName.trim().length === 0) {
        return { valid: false, message: '物品名称不能为空' };
      }
    }

    return { valid: true };
  }

  /**
   * 判断物品是否可以进行指定的操作
   */
  private canItemBeUsed(item: any, useType: string, mcData: minecraftData.IndexedData): { canUse: boolean; message?: string } {

    switch (useType) {
      case 'consume':
        // 检查是否是食物
        if (!isFoodItem(item.name, mcData)) {
          return { canUse: false, message: `物品 ${item.name} 不是可食用的物品` };
        }
        break;

      case 'activate':
        // 大多数物品都可以激活，特殊情况可以在这里添加验证
        const nonActivatableItems = ['air'];
        if (nonActivatableItems.includes(item.name)) {
          return { canUse: false, message: `物品 ${item.name} 不能被激活` };
        }
        break;

      case 'useOn':
        // 检查是否是可以对实体使用的物品
        const entityUsableItems = ['saddle', 'shears', 'name_tag', 'lead'];
        if (!entityUsableItems.includes(item.name) && !item.name.includes('dye')) {
          this.logger.warn(`物品 ${item.name} 可能不适合对实体使用`);
        }
        break;

      default:
        return { canUse: false, message: `未知的使用类型: ${useType}` };
    }

    return { canUse: true };
  }
}
