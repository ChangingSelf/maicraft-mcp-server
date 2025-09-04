import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { MovementUtils, GoalType } from './MovementUtils.js';

export interface ContainerInfo {
  location: {
    x: number;
    y: number;
    z: number;
  };
  contents: Array<{
    name: string;
    count: number;
    slot?: number;
  }>;
  operations: string[];
  successCount: number;
  errorCount: number;
}

export class ContainerUtils {
  /**
   * 查找容器（指定坐标或最近的）
   */
  static findContainer(bot: Bot, containerType: string, mcData: any, x?: number, y?: number, z?: number): any {
    const expectedBlockId = mcData.blocksByName[containerType]?.id;

    if (!expectedBlockId) {
      throw new Error(`未知的方块名称: ${containerType}`);
    }

    if (x !== undefined && y !== undefined && z !== undefined) {
      // 查找指定坐标的容器
      const pos = new Vec3(x, y, z);
      const containerBlock = bot.blockAt(pos);
      if (!containerBlock) {
        throw new Error(`指定坐标 (${x}, ${y}, ${z}) 处没有方块`);
      }
      if (containerBlock.type !== expectedBlockId) {
        const actualBlockName = mcData.blocks[containerBlock.type]?.name || `未知方块(${containerBlock.type})`;
        throw new Error(`指定坐标 (${x}, ${y}, ${z}) 处是 ${actualBlockName}，不是 ${containerType}`);
      }
      return containerBlock;
    } else {
      // 找到最近的容器
      const containerBlock = bot.findBlock({ matching: expectedBlockId, maxDistance: 32 });
      if (!containerBlock) {
        throw new Error(`附近没有 ${containerType}`);
      }
      return containerBlock;
    }
  }

  /**
   * 查找多个容器（按距离排序）
   */
  static findMultipleContainers(bot: Bot, containerType: string, mcData: any, maxDistance: number = 32): any[] {
    const containerBlocks: any[] = [];
    const visitedPositions = new Set<string>();
    const expectedBlockId = mcData.blocksByName[containerType]?.id;

    if (!expectedBlockId) {
      throw new Error(`未知的方块名称: ${containerType}`);
    }

    // 使用 findBlocks 方法查找所有容器位置，然后按距离排序
    const allContainerPositions = bot.findBlocks({
      matching: expectedBlockId,
      maxDistance: maxDistance,
      count: 20 // 最多查找20个容器
    });

    // 按距离排序
    allContainerPositions.sort((a, b) => {
      const distA = bot.entity.position.distanceTo(a);
      const distB = bot.entity.position.distanceTo(b);
      return distA - distB;
    });

    // 去重并转换为方块对象
    for (const pos of allContainerPositions) {
      if (containerBlocks.length >= 10) break; // 最多10个容器

      const posKey = `${pos.x},${pos.y},${pos.z}`;
      if (!visitedPositions.has(posKey)) {
        visitedPositions.add(posKey);
        const block = bot.blockAt(pos);
        if (block) {
          containerBlocks.push(block);
        }
      }
    }

    return containerBlocks;
  }

  /**
   * 移动到容器附近
   */
  static async moveToContainer(bot: Bot, containerBlock: any, containerType: string): Promise<void> {
    // 使用统一的移动工具类移动到容器位置，使用 GoalGetToBlock 目标类型
    const moveResult = await MovementUtils.moveTo(
      bot,
      {
        type: 'coordinate',
        x: containerBlock.position.x,
        y: containerBlock.position.y,
        z: containerBlock.position.z,
        distance: 3, // 到达距离（稍微远一点，以便更好地看到容器）
        maxDistance: 32, // 最大移动距离
        useRelativeCoords: false, // 不使用相对坐标
        goalType: GoalType.GoalGetToBlock // 使用获取方块目标类型
      }
    );

    if (!moveResult.success) {
      const containerName = this.getContainerDisplayName(containerType);
      throw new Error(`无法移动到${containerName}位置 (${containerBlock.position.x}, ${containerBlock.position.y}, ${containerBlock.position.z}): ${moveResult.error}`);
    }
  }

  /**
   * 打开容器
   */
  static async openContainer(bot: Bot, containerType: string, containerBlock: any): Promise<any> {
    let container;
    if (containerType === 'furnace') {
      container = await bot.openFurnace(containerBlock);
    } else if (containerType === 'blast_furnace') {
      container = await bot.openContainer(containerBlock);
    } else if (containerType === 'smoker') {
      container = await bot.openContainer(containerBlock);
    } else if (containerType === 'dispenser' || containerType === 'dropper') {
      container = await bot.openContainer(containerBlock);
    } else {
      // 默认使用 openContainer，适用于 chest、trapped_chest 等
      container = await bot.openContainer(containerBlock);
    }
    return container;
  }

  /**
   * 获取容器显示名称
   */
  static getContainerDisplayName(containerType: string): string {
    const nameMap: { [key: string]: string } = {
      'chest': '箱子',
      'trapped_chest': '陷阱箱',
      'furnace': '熔炉',
      'blast_furnace': '高炉',
      'smoker': '烟熏炉',
      'dispenser': '发射器',
      'dropper': '投掷器'
    };
    return nameMap[containerType] || containerType;
  }

  /**
   * 验证槽位是否有效
   */
  static validateSlot(slot: number, containerType: string): boolean {
    if (isNaN(slot) || slot < 0) {
      return false;
    }

    // 不同容器类型的槽位限制
    const slotLimits: { [key: string]: number } = {
      'chest': 27,
      'trapped_chest': 27,
      'dispenser': 9,
      'dropper': 9,
      'furnace': 3,
      'blast_furnace': 3,
      'smoker': 3
    };

    const limit = slotLimits[containerType];
    return limit ? slot < limit : true;
  }

  /**
   * 获取容器内容信息
   */
  static getContainerContents(container: any, containerType: string, mcData: any): any[] {
    if (containerType === 'furnace' || containerType === 'blast_furnace' || containerType === 'smoker') {
      const contents = [];

      const inputItem = container.inputItem();
      if (inputItem) {
        contents.push({
          name: inputItem.name || `未知物品(${inputItem.type})`,
          count: inputItem.count,
          slot: 0 // 熔炉输入槽
        });
      }

      const fuelItem = container.fuelItem();
      if (fuelItem) {
        contents.push({
          name: fuelItem.name || `未知物品(${fuelItem.type})`,
          count: fuelItem.count,
          slot: 1 // 熔炉燃料槽
        });
      }

      const outputItem = container.outputItem();
      if (outputItem) {
        contents.push({
          name: outputItem.name || `未知物品(${outputItem.type})`,
          count: outputItem.count,
          slot: 2 // 熔炉输出槽
        });
      }

      return contents;
    } else {
      // 箱子内容
      const containerItems = container.containerItems();
      return containerItems.map((item: any, index: number) => ({
        name: item.name || `未知物品(${item.type})`,
        count: item.count,
        slot: item.slot || index // 使用物品的槽位号
      }));
    }
  }
}
