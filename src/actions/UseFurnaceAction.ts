import { Bot, Furnace } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { ContainerUtils, ContainerInfo } from '../utils/ContainerUtils.js';

// 熔炉操作类型枚举
export enum FurnaceOperation {
  PUT = 'put',      // 放入物品
  TAKE = 'take',    // 取出物品
  VIEW = 'view'     // 查看状态
}

/**
 * 熔炉操作使用示例：
 *
 * 1. 放入物品（默认操作）：
 * {
 *   "items": [
 *     {"name": "iron_ore", "count": 10, "position": "input"},
 *     {"name": "coal", "count": 5, "position": "fuel"}
 *   ]
 * }
 *
 * 2. 取出指定槽位的物品：
 * {
 *   "action": "take",
 *   "items": [
 *     {"position": "output"},
 *     {"position": "input"}
 *   ]
 * }
 *
 * 3. 查看熔炉状态：
 * {
 *   "action": "view"
 * }
 *
 * 4. 自动判断位置：
 * {
 *   "items": [
 *     {"name": "iron_ore", "count": 10},  // 自动→input
 *     {"name": "coal", "count": 5}         // 自动→fuel
 *   ]
 * }
 *
 * 注意：每个槽位在一次操作中只能指定一次，避免冲突
 */

interface FurnaceItem {
  name?: string; // 可选：物品名称（put操作必需，take操作可选）
  count?: number; // 可选：物品数量，默认为1（仅put操作使用）
  position?: 'input' | 'fuel' | 'output'; // 可选：语义化位置，默认为根据物品类型自动判断（仅put操作使用）
}

interface UseFurnaceParams extends BaseActionParams {
  /** 容器方块名称：furnace、blast_furnace、smoker，默认furnace */
  container_type?: string;
  /** 操作类型：put(放入，默认) 或 take(取出) 或 view(查看) */
  action?: string;
  /** 物品及其数量的对象数组：put操作必需，take/view操作不需要 */
  items?: FurnaceItem[];
  /** 容器坐标，可选，不指定则寻找最近的容器 */
  x?: number;
  y?: number;
  z?: number;
  /** 是否自动查找附近其他容器，默认false */
  auto_search?: boolean;
}

// 多容器操作结果接口
interface MultiContainerResult {
  totalContainers: number;
  totalSuccessCount: number;
  totalErrorCount: number;
  containers: ContainerInfo[];
  remainingItems: FurnaceItem[]; // 未能完全取出的物品
  summary: string;
}

export class UseFurnaceAction extends BaseAction<UseFurnaceParams> {
  name = 'useFurnace';
  description = '熔炉操作：1.put放入物品（支持input/fuel位置，燃料不能放input）；2.take按槽位取出；3.view查看状态。容器默认furnace，auto_search默认false，每个槽位只能操作一次。参数结构：{container_type:"furnace",action:"put",items:[{name:"iron_ore",count:10,position:"input"}],x?:number,y?:number,z?:number,auto_search?:false}';
  schema = z.object({
    container_type: z.enum(['furnace', 'blast_furnace', 'smoker']).optional().default('furnace').describe('容器方块名称: furnace、blast_furnace、smoker (默认furnace)'),
    action: z.enum([FurnaceOperation.PUT, FurnaceOperation.TAKE, FurnaceOperation.VIEW]).optional().default(FurnaceOperation.PUT).describe('操作类型：put(放入，默认)、take(取出)或view(查看)'),
    items: z.array(z.object({
      name: z.string().optional().describe('物品名称：put操作必需，take操作不需要，view操作不需要'),
      count: z.number().int().min(1).optional().describe('物品数量，默认为1（仅put操作使用）'),
      position: z.enum(['input', 'fuel', 'output']).optional().describe('语义化位置：put操作可选（自动判断），take操作必需')
    })).optional().describe('物品数组：put操作必需（指定物品），take操作必需（指定槽位），view操作不需要。注意：每个槽位只能出现一次'),
    x: z.number().int().optional().describe('容器X坐标 (整数，可选)'),
    y: z.number().int().optional().describe('容器Y坐标 (整数，可选)'),
    z: z.number().int().optional().describe('容器Z坐标 (整数，可选)'),
    auto_search: z.boolean().optional().default(false).describe('未指定容器位置时是否自动查找附近其他容器 (默认false)'),
  });

  /**
   * 验证物品数组中的位置是否重复
   */
  private validateUniquePositions(items: FurnaceItem[] | undefined): string[] {
    const errors: string[] = [];
    if (!items) return errors;

    const positionCount: { [key: string]: number } = {};
    const positionItems: { [key: string]: string[] } = {};

    for (const item of items) {
      const position = item.position;
      if (!position) continue;

      positionCount[position] = (positionCount[position] || 0) + 1;

      if (!positionItems[position]) {
        positionItems[position] = [];
      }
      positionItems[position].push(item.name || '未命名物品');
    }

    for (const [position, count] of Object.entries(positionCount)) {
      if (count > 1) {
        const itemNames = positionItems[position].join(', ');
        errors.push(`槽位 ${position} 被指定了 ${count} 次（物品: ${itemNames}），每个槽位只能操作一次`);
      }
    }

    return errors;
  }

  /**
   * 根据物品类型和用户指定的位置确定最终位置
   */
  private determineItemPosition(itemName: string | undefined, specifiedPosition: 'input' | 'fuel' | 'output' | undefined): 'input' | 'fuel' | 'output' {
    // 如果用户明确指定了位置，直接使用
    if (specifiedPosition) {
      return specifiedPosition;
    }

    // 如果没有指定位置，根据物品类型自动判断
    if (!itemName) {
      return 'input'; // 默认放到输入槽
    }

    return this.isFuelItem(itemName) ? 'fuel' : 'input';
  }

  /**
   * 验证物品并设置默认值，返回物品元数据
   */
  private validateItems(items: FurnaceItem[], mcData: any, action: string): { itemMetas: any[], validItems: FurnaceItem[] } {
    const itemMetas = [];
    const validItems = [];
    const invalidItems = [];

    // 验证位置是否重复
    const positionErrors = this.validateUniquePositions(items);
    if (positionErrors.length > 0) {
      throw new Error(positionErrors.join('; '));
    }

    for (const item of items) {
      // 设置默认值
      const processedItem: FurnaceItem = {
        name: item.name,
        count: item.count || 1, // 默认数量为1
        position: this.determineItemPosition(item.name, item.position)
      };

      // 根据操作类型验证必需的字段
      if (action === FurnaceOperation.PUT) {
        // put操作需要name
        if (!processedItem.name) {
          throw new Error('放入操作必须指定物品名称');
        }
        const itemMeta = mcData.itemsByName[processedItem.name];
        if (!itemMeta) {
          invalidItems.push(processedItem.name);
          continue;
        }
        itemMetas.push(itemMeta);
      } else if (action === FurnaceOperation.TAKE) {
        // take操作只需要position
        if (!processedItem.position) {
          throw new Error('取出操作必须指定槽位位置');
        }
        itemMetas.push(null); // take操作不需要物品元数据
      }

      validItems.push(processedItem);
    }

    if (invalidItems.length > 0) {
      throw new Error(`未知物品: ${invalidItems.join(', ')}`);
    }

    return { itemMetas, validItems };
  }

  /**
   * 执行存储、取出或查看操作
   */
  private async performOperations(
    container: Furnace,
    action: string,
    items: FurnaceItem[] | undefined,
    itemMetas: any[],
    bot: Bot,
    containerType: string
  ): Promise<{ results: string[], successCount: number, totalErrors: number }> {
    const results: string[] = [];
    let successCount = 0;
    let totalErrors = 0;

    if (action === FurnaceOperation.PUT) {
      // 放入操作
      if (!items || items.length === 0) {
        results.push('放入操作需要指定物品');
        totalErrors++;
      } else {
        for (let i = 0; i < items.length; i++) {
          const success = await this.performStoreOperation(container, items[i].name, itemMetas[i], items[i].count || 1, bot, results, items[i].position, containerType);
          if (success) {
            successCount++;
          } else {
            totalErrors++;
          }
        }
      }
    } else if (action === FurnaceOperation.TAKE) {
      // 取出操作 - 根据指定的槽位取出物品
      if (!items || items.length === 0) {
        results.push('取出操作需要指定要取出的槽位');
        totalErrors++;
      } else {
        for (let i = 0; i < items.length; i++) {
          const success = await this.performWithdrawOperation(container, items[i].name, undefined, 0, results, items[i].position, containerType, bot);
          if (success) {
            successCount++;
          } else {
            totalErrors++;
          }
        }
      }
    } else if (action === FurnaceOperation.VIEW) {
      // 查看操作
      const success = await this.performViewOperation(container, results);
      if (success) {
        successCount++;
      } else {
        totalErrors++;
      }
    } else {
      results.push(`不支持操作 ${action}`);
      totalErrors++;
    }

    return { results, successCount, totalErrors };
  }

    /**
   * 执行查看操作
   */
  private async performViewOperation(
    container: Furnace,
    results: string[]
  ): Promise<boolean> {
    try {
      const inputItem = container.inputItem();
      const fuelItem = container.fuelItem();
      const outputItem = container.outputItem();

      results.push('🔍 熔炉状态：');

      // 输入槽
      if (inputItem) {
        results.push(`  📥 输入槽: ${inputItem.name} × ${inputItem.count}`);
      } else {
        results.push('  📥 输入槽: 空');
      }

      // 燃料槽
      if (fuelItem) {
        results.push(`  🔥 燃料槽: ${fuelItem.name} × ${fuelItem.count}`);
      } else {
        results.push('  🔥 燃料槽: 空');
      }

      // 输出槽
      if (outputItem) {
        results.push(`  📤 输出槽: ${outputItem.name} × ${outputItem.count}`);
      } else {
        results.push('  📤 输出槽: 空');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      results.push(`查看熔炉状态失败: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 执行单个存储操作
   */
  private async performStoreOperation(
    container: Furnace,
    itemName: string | undefined,
    itemMeta: any,
    count: number,
    bot: Bot,
    results: string[],
    position?: 'input' | 'fuel' | 'output',
    containerType?: string
  ): Promise<boolean> {
    let depositCount = 0;

    try {
      // 存储操作必须指定物品名称
      if (!itemName || !itemMeta) {
        results.push('存储操作必须指定物品名称');
        return false;
      }

      const invItem = bot.inventory.findInventoryItem(itemMeta.id, null, false);
      if (!invItem) {
        results.push(`背包没有 ${itemName}`);
        return false;
      }

      depositCount = Math.min(count, invItem.count);

      if (position) {
        // 验证燃料物品不能放入输入槽
        if (position === 'input' && this.isFuelItem(itemName)) {
          results.push(`燃料物品 ${itemName} 不能放入输入槽，请使用fuel位置`);
          return false;
        }

        // 直接使用熔炉的语义化方法
        switch (position) {
          case 'input':
            await container.putInput(itemMeta.id, null, depositCount);
            results.push(`已存入 ${itemName} ${depositCount} 个到输入槽`);
            break;
          case 'fuel':
            await container.putFuel(itemMeta.id, null, depositCount);
            results.push(`已存入 ${itemName} ${depositCount} 个到燃料槽`);
            break;
          case 'output':
            results.push(`不能向输出槽添加物品`);
            return false;
          default:
            results.push(`无效的位置: ${position}`);
            return false;
        }
      } else {
        // 没有指定位置，自动判断物品类型并放入相应槽位
        const isFuel = this.isFuelItem(itemName);
        if (isFuel) {
          await container.putFuel(itemMeta.id, null, depositCount);
          results.push(`已存入 ${itemName} ${depositCount} 个到燃料槽`);
        } else {
          await container.putInput(itemMeta.id, null, depositCount);
          results.push(`已存入 ${itemName} ${depositCount} 个到输入槽`);
        }
      }

      return true;
    } catch (itemErr) {
      const errorMessage = itemErr instanceof Error ? itemErr.message : String(itemErr);
      const itemDisplayName = itemName || '未知物品';
      const positionMsg = position ? `到${position}槽` : '';
      const detailedError = `存储 ${itemDisplayName} ${positionMsg}失败: ${errorMessage} (尝试存入 ${depositCount} 个)`;
      results.push(detailedError);
      return false;
    }
  }

    /**
   * 执行取出操作 - 根据指定槽位取出物品
   */
  private async performWithdrawOperation(
    container: Furnace,
    itemName: string | undefined,
    itemMeta: any,
    count: number,
    results: string[],
    position?: 'input' | 'fuel' | 'output',
    containerType?: string,
    bot?: Bot
  ): Promise<boolean> {
    try {
      if (!position) {
        results.push('取出操作必须指定槽位位置');
        return false;
      }

      let targetItem;
      let positionName: string;

      // 根据位置获取物品
      switch (position) {
        case 'input':
          targetItem = container.inputItem();
          positionName = '输入槽';
          break;
        case 'fuel':
          targetItem = container.fuelItem();
          positionName = '燃料槽';
          break;
        case 'output':
          targetItem = container.outputItem();
          positionName = '输出槽';
          break;
        default:
          results.push(`无效的位置: ${position}`);
          return false;
      }

      if (!targetItem) {
        results.push(`${positionName}没有物品可以取出`);
        return false;
      }

      // 取出物品
      switch (position) {
        case 'input':
          await container.takeInput();
          break;
        case 'fuel':
          await container.takeFuel();
          break;
        case 'output':
          await container.takeOutput();
          break;
      }

      results.push(`已取出 ${targetItem.name} ${targetItem.count} 个（${positionName}）`);
      return true;
    } catch (itemErr) {
      const errorMessage = itemErr instanceof Error ? itemErr.message : String(itemErr);
      results.push(`取出物品失败: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 判断物品是否为燃料
   */
  private isFuelItem(itemName: string): boolean {
    // 常见的燃料物品列表
    const fuelItems = [
      'coal', 'charcoal', 'coal_block', 'lava_bucket',
      'blaze_rod', 'dried_kelp_block', 'bamboo', 'stick'
    ];
    return fuelItems.includes(itemName.toLowerCase());
  }

  /**
   * 执行多容器取出操作
   */
  private async performMultiContainerTake(
    bot: Bot,
    containerType: string,
    mcData: any
  ): Promise<MultiContainerResult> {
    const containers: ContainerInfo[] = [];
    let totalSuccessCount = 0;
    let totalErrorCount = 0;

    // 查找多个容器
    const containerBlocks = ContainerUtils.findMultipleContainers(bot, containerType, mcData);

    if (containerBlocks.length === 0) {
      const containerName = ContainerUtils.getContainerDisplayName(containerType);
      throw new Error(`附近没有找到任何${containerName}`);
    }

    // 遍历每个容器
    for (const containerBlock of containerBlocks) {
      const containerInfo: ContainerInfo = {
        location: {
          x: containerBlock.position.x,
          y: containerBlock.position.y,
          z: containerBlock.position.z
        },
        contents: [],
        operations: [],
        successCount: 0,
        errorCount: 0
      };

      try {
        // 移动到容器附近
        await ContainerUtils.moveToContainer(bot, containerBlock, containerType);

        // 打开容器
        const container = await ContainerUtils.openContainer(bot, containerType, containerBlock);

        try {
          // 获取容器内容
          containerInfo.contents = ContainerUtils.getContainerContents(container, containerType, mcData);

          // 直接取出所有物品
          const success = await this.performWithdrawOperation(container, undefined, undefined, 0, containerInfo.operations, undefined, containerType, bot);

          if (success) {
            containerInfo.successCount++;
            totalSuccessCount++;
            containerInfo.operations.push('✅ 已取出所有物品');
          } else {
            containerInfo.errorCount++;
            totalErrorCount++;
          }

        } finally {
          container.close();
        }

        containers.push(containerInfo);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const containerName = ContainerUtils.getContainerDisplayName(containerType);
        containerInfo.operations.push(`❌ 访问${containerName}失败: ${errorMessage}`);
        containerInfo.errorCount++;
        totalErrorCount++;
        containers.push(containerInfo);
      }
    }

    // 生成摘要
    const summary = this.generateMultiContainerSummary(
      containers.length,
      totalSuccessCount,
      totalErrorCount,
      [],
      containerType
    );

    return {
      totalContainers: containers.length,
      totalSuccessCount,
      totalErrorCount,
      containers,
      remainingItems: [],
      summary
    };
  }

  /**
   * 生成多容器操作摘要
   */
  private generateMultiContainerSummary(
    totalContainers: number,
    totalSuccessCount: number,
    totalErrorCount: number,
    remainingItems: FurnaceItem[],
    containerType: string
  ): string {
    const parts: string[] = [];
    const containerName = ContainerUtils.getContainerDisplayName(containerType);

    parts.push(`访问了 ${totalContainers} 个${containerName}`);
    parts.push(`成功操作: ${totalSuccessCount} 次`);

    if (totalErrorCount > 0) {
      parts.push(`失败操作: ${totalErrorCount} 次`);
    }

    if (remainingItems.length > 0) {
      const remainingList = remainingItems.map(item => `${item.name || '未知物品'}(${item.count || 1})`).join(', ');
      parts.push(`未能完全取出: ${remainingList}`);
    } else {
      parts.push('所有物品已完全取出');
    }

    return parts.join('; ');
  }

  /**
   * 创建操作结果
   */
  private createOperationResult(
    results: string[],
    containerContents: any[],
    containerBlock: any,
    successCount: number,
    totalErrors: number,
    containerType: string
  ): ActionResult {
    const resultMessage = results.join('; ');
    const containerName = ContainerUtils.getContainerDisplayName(containerType);

    if (successCount > 0 && totalErrors === 0) {
      return {
        success: true,
        message: resultMessage,
        data: {
          operationResults: results,
          containerContents: containerContents,
          containerLocation: {
            x: containerBlock.position.x,
            y: containerBlock.position.y,
            z: containerBlock.position.z
          },
          containerType: containerType
        }
      };
    } else if (successCount > 0) {
      return {
        success: true,
        message: `部分成功: ${resultMessage}`,
        data: {
          operationResults: results,
          containerContents: containerContents,
          containerLocation: {
            x: containerBlock.position.x,
            y: containerBlock.position.y,
            z: containerBlock.position.z
          },
          containerType: containerType
        }
      };
    } else {
      // 所有操作都失败的情况
      return {
        success: false,
        message: `所有操作失败: ${resultMessage}`,
        data: {
          operationResults: results,
          containerContents: containerContents,
          containerLocation: {
            x: containerBlock.position.x,
            y: containerBlock.position.y,
            z: containerBlock.position.z
          },
          containerType: containerType
        },
        error: `ALL_OPERATIONS_FAILED: ${results.join('; ')}`
      };
    }
  }

  /**
   * 创建多容器操作结果
   */
  private createMultiContainerResult(
    multiContainerResult: MultiContainerResult,
    containerType: string
  ): ActionResult {
    const { totalContainers, totalSuccessCount, totalErrorCount, remainingItems, summary } = multiContainerResult;

    if (totalSuccessCount > 0 && remainingItems.length === 0) {
      return {
        success: true,
        message: summary,
        data: multiContainerResult
      };
    } else if (totalSuccessCount > 0) {
      return {
        success: true,
        message: `部分成功: ${summary}`,
        data: multiContainerResult
      };
    } else {
      return {
        success: false,
        message: `所有操作失败: ${summary}`,
        data: multiContainerResult,
        error: `ALL_OPERATIONS_FAILED: ${summary}`
      };
    }
  }

  async execute(bot: Bot, params: UseFurnaceParams): Promise<ActionResult> {
    try {

      const action = params.action?.toLowerCase() ?? FurnaceOperation.VIEW;
      const containerType = params.container_type ?? 'furnace';
      const autoSearch = params.auto_search ?? false;
      const mcData = minecraftData(bot.version);

      // 验证所有物品是否存在
      let itemMetas: any[] = [];
      let validItems: FurnaceItem[] = [];
      if (params.items && params.items.length > 0) {
        const validation = this.validateItems(params.items, mcData, action);
        itemMetas = validation.itemMetas;
        validItems = validation.validItems;
      }

      // take操作需要指定具体容器，不支持多容器自动查找
      if (action === FurnaceOperation.TAKE &&
          params.x === undefined && params.y === undefined && params.z === undefined &&
          autoSearch) {
        throw new Error('take操作需要指定具体的熔炉位置，不支持多容器自动查找');
      }

      // 单容器操作
      const containerBlock = ContainerUtils.findContainer(bot, containerType, mcData, params.x, params.y, params.z);
      await ContainerUtils.moveToContainer(bot, containerBlock, containerType);

      // 打开容器
      const container = await ContainerUtils.openContainer(bot, containerType, containerBlock);

      try {
        const { results, successCount, totalErrors } = await this.performOperations(
          container,
          action,
          validItems.length > 0 ? validItems : undefined,
          itemMetas,
          bot,
          containerType
        );

        const containerContents = ContainerUtils.getContainerContents(container, containerType, mcData);
        return this.createOperationResult(results, containerContents, containerBlock, successCount, totalErrors, containerType);
      } finally {
        container.close();
      }
    } catch (err) {
      const containerName = ContainerUtils.getContainerDisplayName(params.container_type || 'furnace');
      return this.createExceptionResult(err, `${containerName}交互失败`, 'CONTAINER_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: use_furnace）
}
