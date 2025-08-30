import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import pathfinder from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import { MovementUtils } from '../utils/MovementUtils.js';

interface ItemWithCount {
  name: string;
  count: number;
}

interface UseChestParams extends BaseActionParams {
  /** store | withdraw，默认是 store */
  action?: string;
  /** 物品及其数量的对象数组 */
  items: ItemWithCount[];
  /** 箱子坐标，可选，不指定则寻找最近的箱子 */
  x?: number;
  y?: number;
  z?: number;
}

// 新增：单个箱子信息接口
interface ChestInfo {
  location: {
    x: number;
    y: number;
    z: number;
  };
  contents: Array<{
    name: string;
    count: number;
  }>;
  operations: string[];
  successCount: number;
  errorCount: number;
}

// 新增：多箱子操作结果接口
interface MultiChestResult {
  totalChests: number;
  totalSuccessCount: number;
  totalErrorCount: number;
  chests: ChestInfo[];
  remainingItems: ItemWithCount[]; // 未能完全取出的物品
  summary: string;
}

export class UseChestAction extends BaseAction<UseChestParams> {
  name = 'useChest';
  description = '与箱子交互，默认存储操作，支持为每种物品指定不同数量。取出操作时，如果未指定特定箱子，会自动从附近多个箱子中取够所需物品，并返回所有相关箱子的内容信息';
  schema = z.object({
    action: z.enum(['store', 'withdraw']).optional().describe('操作类型 (store | withdraw，默认是 store)'),
    items: z.array(z.object({
      name: z.string().describe('物品名称'),
      count: z.number().int().min(1).describe('物品数量')
    })).min(1).describe('物品及其数量的对象数组，至少包含一个物品'),
    x: z.number().int().optional().describe('箱子X坐标 (整数，可选)'),
    y: z.number().int().optional().describe('箱子Y坐标 (整数，可选)'),
    z: z.number().int().optional().describe('箱子Z坐标 (整数，可选)'),
  });

  /**
   * 验证物品是否存在并返回物品元数据
   */
  private validateItems(items: ItemWithCount[], mcData: any): { itemMetas: any[], validItems: ItemWithCount[] } {
    const itemMetas = [];
    const validItems = [];
    const invalidItems = [];

    for (const item of items) {
      const itemMeta = mcData.itemsByName[item.name];
      if (!itemMeta) {
        invalidItems.push(item.name);
      } else {
        itemMetas.push(itemMeta);
        validItems.push(item);
      }
    }

    if (invalidItems.length > 0) {
      throw new Error(`未知物品: ${invalidItems.join(', ')}`);
    }

    return { itemMetas, validItems };
  }

  /**
   * 查找箱子（指定坐标或最近的）
   */
  private findChest(bot: Bot, params: UseChestParams, mcData: any): any {
    if (params.x !== undefined && params.y !== undefined && params.z !== undefined) {
      // 查找指定坐标的箱子
      const pos = new Vec3(params.x, params.y, params.z);
      const chestBlock = bot.blockAt(pos);
      if (!chestBlock) {
        throw new Error(`指定坐标 (${params.x}, ${params.y}, ${params.z}) 处没有方块`);
      }
      if (chestBlock.type !== mcData.blocksByName.chest.id) {
        const blockName = mcData.blocks[chestBlock.type]?.name || `未知方块(${chestBlock.type})`;
        throw new Error(`指定坐标 (${params.x}, ${params.y}, ${params.z}) 处是 ${blockName}，不是箱子`);
      }
      return chestBlock;
    } else {
      // 找到最近箱子
      const chestBlock = bot.findBlock({ matching: mcData.blocksByName.chest.id, maxDistance: 16 });
      if (!chestBlock) {
        throw new Error('附近没有箱子');
      }
      return chestBlock;
    }
  }

  /**
   * 查找多个箱子（按距离排序）
   */
  private findMultipleChests(bot: Bot, mcData: any, maxDistance: number = 32): any[] {
    const chestBlocks: any[] = [];
    const visitedPositions = new Set<string>();
    
    // 使用 findBlocks 方法查找所有箱子位置，然后按距离排序
    const allChestPositions = bot.findBlocks({
      matching: mcData.blocksByName.chest.id,
      maxDistance: maxDistance,
      count: 20 // 最多查找20个箱子
    });
    
    // 按距离排序
    allChestPositions.sort((a, b) => {
      const distA = bot.entity.position.distanceTo(a);
      const distB = bot.entity.position.distanceTo(b);
      return distA - distB;
    });
    
    // 去重并转换为方块对象
    for (const pos of allChestPositions) {
      if (chestBlocks.length >= 10) break; // 最多10个箱子
      
      const posKey = `${pos.x},${pos.y},${pos.z}`;
      if (!visitedPositions.has(posKey)) {
        visitedPositions.add(posKey);
        const block = bot.blockAt(pos);
        if (block) {
          chestBlocks.push(block);
        }
      }
    }
    
    return chestBlocks;
  }

  /**
   * 移动到箱子附近
   */
  private async moveToChest(bot: Bot, chestBlock: any): Promise<void> {
    // 使用统一的移动工具类移动到箱子位置
    const moveResult = await MovementUtils.moveToCoordinate(
      bot,
      chestBlock.position.x,
      chestBlock.position.y,
      chestBlock.position.z,
      3, // 到达距离（稍微远一点，以便更好地看到箱子）
      32, // 最大移动距离
      false // 不使用相对坐标
    );

    if (!moveResult.success) {
      throw new Error(`无法移动到箱子位置 (${chestBlock.position.x}, ${chestBlock.position.y}, ${chestBlock.position.z}): ${moveResult.error}`);
    }
  }

  /**
   * 执行存储或取出操作
   */
  private async performOperations(
    chest: any,
    action: string,
    items: ItemWithCount[],
    itemMetas: any[],
    bot: Bot
  ): Promise<{ results: string[], successCount: number, totalErrors: number }> {
    const results: string[] = [];
    let successCount = 0;
    let totalErrors = 0;

    if (action === 'store') {
      // 存储多种物品
      for (let i = 0; i < items.length; i++) {
        const success = await this.performStoreOperation(chest, items[i].name, itemMetas[i], items[i].count, bot, results);
        if (success) {
          successCount++;
        } else {
          totalErrors++;
        }
      }
    } else if (action === 'withdraw') {
      // 取出多种物品
      for (let i = 0; i < items.length; i++) {
        const { success, shortage } = await this.performWithdrawOperation(chest, items[i].name, itemMetas[i], items[i].count, results);
        if (success) {
          successCount++;
        } else {
          totalErrors++;
        }
        // 处理库存不足的情况
        if (shortage > 0) {
          results.push(`⚠️ ${items[i].name} 库存不足，还差 ${shortage} 个`);
        }
      }
    } else {
      results.push(`未知动作 ${action}`);
      totalErrors++;
    }

    return { results, successCount, totalErrors };
  }

  /**
   * 执行单个存储操作
   */
  private async performStoreOperation(
    chest: any,
    itemName: string,
    itemMeta: any,
    count: number,
    bot: Bot,
    results: string[]
  ): Promise<boolean> {
    let depositCount = 0;
    try {
      const invItem = bot.inventory.findInventoryItem(itemMeta.id, null, false);
      if (!invItem) {
        results.push(`背包没有 ${itemName}`);
        return false;
      }

      depositCount = Math.min(count, invItem.count);
      await chest.deposit(itemMeta.id, null, depositCount);
      results.push(`已存入 ${itemName} ${depositCount} 个`);
      return true;
    } catch (itemErr) {
      const errorMessage = itemErr instanceof Error ? itemErr.message : String(itemErr);
      const detailedError = `存储 ${itemName} 失败: ${errorMessage} (尝试存入 ${depositCount} 个)`;
      results.push(detailedError);
      return false;
    }
  }

  /**
   * 执行单个取出操作
   */
  private async performWithdrawOperation(
    chest: any,
    itemName: string,
    itemMeta: any,
    count: number,
    results: string[]
  ): Promise<{ success: boolean, shortage: number, withdrawn: number }> {
    let withdrawCount = 0;
    let shortage = 0;

    try {
      const chestItem = chest.containerItems().find((it: any) => it.type === itemMeta.id);
      if (!chestItem) {
        results.push(`箱子中没有 ${itemName}`);
        return { success: false, shortage: count, withdrawn: 0 };
      }

      withdrawCount = Math.min(count, chestItem.count);
      shortage = Math.max(0, count - chestItem.count);

      await chest.withdraw(itemMeta.id, null, withdrawCount);
      results.push(`已取出 ${itemName} ${withdrawCount} 个`);
      return { success: true, shortage, withdrawn: withdrawCount };
    } catch (itemErr) {
      const errorMessage = itemErr instanceof Error ? itemErr.message : String(itemErr);
      const detailedError = `取出 ${itemName} 失败: ${errorMessage} (尝试取出 ${withdrawCount} 个)`;
      results.push(detailedError);
      return { success: false, shortage, withdrawn: 0 };
    }
  }

  /**
   * 获取箱子内容信息
   */
  private getChestContents(chest: any, mcData: any): any[] {
    const containerItems = chest.containerItems();
    return containerItems.map((item: any) => ({
      name: item.name || `未知物品(${item.type})`,
      count: item.count,
    }));
  }

  /**
   * 创建操作结果
   */
  private createOperationResult(
    results: string[],
    chestContents: any[],
    chestBlock: any,
    successCount: number,
    totalErrors: number
  ): ActionResult {
    const resultMessage = results.join('; ');

    if (successCount > 0 && totalErrors === 0) {
      return {
        success: true,
        message: resultMessage,
        data: {
          operationResults: results,
          chestContents: chestContents,
          chestLocation: {
            x: chestBlock.position.x,
            y: chestBlock.position.y,
            z: chestBlock.position.z
          }
        }
      };
    } else if (successCount > 0) {
      return {
        success: true,
        message: `部分成功: ${resultMessage}`,
        data: {
          operationResults: results,
          chestContents: chestContents,
          chestLocation: {
            x: chestBlock.position.x,
            y: chestBlock.position.y,
            z: chestBlock.position.z
          }
        }
      };
    } else {
      // 所有操作都失败的情况
      return {
        success: false,
        message: `所有操作失败: ${resultMessage}`,
        data: {
          operationResults: results,
          chestContents: chestContents,
          chestLocation: {
            x: chestBlock.position.x,
            y: chestBlock.position.y,
            z: chestBlock.position.z
          }
        },
        error: `ALL_OPERATIONS_FAILED: ${results.join('; ')}`
      };
    }
  }

  /**
   * 创建多箱子操作结果
   */
  private createMultiChestResult(
    multiChestResult: MultiChestResult
  ): ActionResult {
    const { totalChests, totalSuccessCount, totalErrorCount, remainingItems, summary } = multiChestResult;

    if (totalSuccessCount > 0 && remainingItems.length === 0) {
      return {
        success: true,
        message: summary,
        data: multiChestResult
      };
    } else if (totalSuccessCount > 0) {
      return {
        success: true,
        message: `部分成功: ${summary}`,
        data: multiChestResult
      };
    } else {
      return {
        success: false,
        message: `所有操作失败: ${summary}`,
        data: multiChestResult,
        error: `ALL_OPERATIONS_FAILED: ${summary}`
      };
    }
  }

  /**
   * 执行多箱子取出操作
   */
  private async performMultiChestWithdraw(
    bot: Bot,
    items: ItemWithCount[],
    itemMetas: any[],
    mcData: any
  ): Promise<MultiChestResult> {
    const chests: ChestInfo[] = [];
    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    
    // 复制物品列表，用于跟踪剩余需求
    const remainingItems = items.map(item => ({ ...item }));
    
    // 查找多个箱子
    const chestBlocks = this.findMultipleChests(bot, mcData);
    
    if (chestBlocks.length === 0) {
      throw new Error('附近没有找到任何箱子');
    }

    // 遍历每个箱子
    for (const chestBlock of chestBlocks) {
      const chestInfo: ChestInfo = {
        location: {
          x: chestBlock.position.x,
          y: chestBlock.position.y,
          z: chestBlock.position.z
        },
        contents: [],
        operations: [],
        successCount: 0,
        errorCount: 0
      };

      try {
        // 移动到箱子附近
        await this.moveToChest(bot, chestBlock);
        
        // 打开箱子
        const chest = await bot.openContainer(chestBlock);
        
        try {
          // 获取箱子内容
          chestInfo.contents = this.getChestContents(chest, mcData);
          
          // 尝试从这个箱子取出剩余需要的物品
          for (let i = 0; i < remainingItems.length; i++) {
            const item = remainingItems[i];
            if (item.count <= 0) continue; // 已经取够了
            
            const { success, shortage, withdrawn } = await this.performWithdrawOperation(
              chest,
              item.name,
              itemMetas[i],
              item.count,
              chestInfo.operations
            );
            
            if (success && withdrawn > 0) {
              chestInfo.successCount++;
              totalSuccessCount++;
              
              // 更新剩余需求
              item.count -= withdrawn;
              
              if (item.count <= 0) {
                chestInfo.operations.push(`✅ 已完全取出 ${item.name}`);
              }
            } else {
              chestInfo.errorCount++;
              totalErrorCount++;
            }
          }
          
        } finally {
          chest.close();
        }
        
        chests.push(chestInfo);
        
        // 检查是否所有物品都已取够
        const allItemsComplete = remainingItems.every(item => item.count <= 0);
        if (allItemsComplete) {
          break; // 提前结束，不需要继续查找其他箱子
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        chestInfo.operations.push(`❌ 访问箱子失败: ${errorMessage}`);
        chestInfo.errorCount++;
        totalErrorCount++;
        chests.push(chestInfo);
      }
    }
    
    // 过滤掉已完全取出的物品
    const finalRemainingItems = remainingItems.filter(item => item.count > 0);
    
    // 生成摘要
    const summary = this.generateMultiChestSummary(
      chests.length,
      totalSuccessCount,
      totalErrorCount,
      finalRemainingItems
    );
    
    return {
      totalChests: chests.length,
      totalSuccessCount,
      totalErrorCount,
      chests,
      remainingItems: finalRemainingItems,
      summary
    };
  }

  /**
   * 生成多箱子操作摘要
   */
  private generateMultiChestSummary(
    totalChests: number,
    totalSuccessCount: number,
    totalErrorCount: number,
    remainingItems: ItemWithCount[]
  ): string {
    const parts: string[] = [];
    
    parts.push(`访问了 ${totalChests} 个箱子`);
    parts.push(`成功操作: ${totalSuccessCount} 次`);
    
    if (totalErrorCount > 0) {
      parts.push(`失败操作: ${totalErrorCount} 次`);
    }
    
    if (remainingItems.length > 0) {
      const remainingList = remainingItems.map(item => `${item.name}(${item.count})`).join(', ');
      parts.push(`未能完全取出: ${remainingList}`);
    } else {
      parts.push('所有物品已完全取出');
    }
    
    return parts.join('; ');
  }

  async execute(bot: Bot, params: UseChestParams): Promise<ActionResult> {
    try {
      const action = (params.action ?? 'store').toLowerCase();
      const mcData = minecraftData(bot.version);

      // 验证所有物品是否存在
      const { itemMetas, validItems } = this.validateItems(params.items, mcData);

      // 如果是取出操作且没有指定特定箱子，则执行多箱子操作
      if (action === 'withdraw' && params.x === undefined && params.y === undefined && params.z === undefined) {
        const multiChestResult = await this.performMultiChestWithdraw(bot, validItems, itemMetas, mcData);
        return this.createMultiChestResult(multiChestResult);
      }

      // 单箱子操作（原有逻辑）
      const chestBlock = this.findChest(bot, params, mcData);
      await this.moveToChest(bot, chestBlock);
      const chest = await bot.openContainer(chestBlock);

      try {
        const { results, successCount, totalErrors } = await this.performOperations(
          chest,
          action,
          validItems,
          itemMetas,
          bot
        );

        const chestContents = this.getChestContents(chest, mcData);
        return this.createOperationResult(results, chestContents, chestBlock, successCount, totalErrors);
      } finally {
        chest.close();
      }
    } catch (err) {
      return this.createExceptionResult(err, '箱子交互失败', 'CHEST_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: use_chest）
} 