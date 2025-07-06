import { Bot } from 'mineflayer';
import { GameAction, ActionResult, BaseActionParams } from '../minecraft/ActionInterface';
import minecraftData from 'minecraft-data';

interface PlaceBlockParams extends BaseActionParams {
  x: number;
  y: number;
  z: number;
  item: string;
  face?: string;
}

export class PlaceBlockAction implements GameAction<PlaceBlockParams> {
  name = 'placeBlock';
  description = '在指定位置放置方块';

  async execute(bot: Bot, params: PlaceBlockParams): Promise<ActionResult> {
    try {
      const position = { x: params.x, y: params.y, z: params.z } as any;
      const referenceBlock = bot.blockAt(position);

      if (!referenceBlock) {
        return {
          success: false,
          message: `位置 (${params.x}, ${params.y}, ${params.z}) 无效`,
          error: 'INVALID_POSITION'
        };
      }

      // 检查 mcData
      const mcData = minecraftData(bot.version);
      if (!mcData) {
        return {
          success: false,
          message: 'mcData 未加载，请检查 mineflayer 版本',
          error: 'MCDATA_NOT_LOADED'
        };
      }

      const item = mcData.itemsByName[params.item];
      if (!item) {
        return {
          success: false,
          message: `未找到物品: ${params.item}`,
          error: 'ITEM_NOT_FOUND'
        };
      }

      // 在背包中查找物品
      const itemInInventory = bot.inventory.items().find(i => i.type === item.id);
      if (!itemInInventory) {
        return {
          success: false,
          message: `背包中没有 ${params.item}`,
          error: 'ITEM_NOT_IN_INVENTORY'
        };
      }

      // 装备物品
      await bot.equip(itemInInventory, 'hand');

      // 默认向上方放置
      const faceVector = { x: 0, y: 1, z: 0 } as any;
      await bot.placeBlock(referenceBlock, faceVector);

      return {
        success: true,
        message: `成功放置方块: ${params.item}`,
        data: { item: params.item, position }
      };
    } catch (error) {
      return {
        success: false,
        message: `放置方块失败: ${error instanceof Error ? error.message : String(error)}`,
        error: 'PLACE_FAILED'
      };
    }
  }

  validateParams(params: PlaceBlockParams): boolean {
    return typeof params.x === 'number' &&
           typeof params.y === 'number' &&
           typeof params.z === 'number' &&
           typeof params.item === 'string' && params.item.length > 0;
  }

  getParamsSchema(): Record<string, string> {
    return {
      x: '目标位置X坐标 (数字)',
      y: '目标位置Y坐标 (数字)',
      z: '目标位置Z坐标 (数字)',
      item: '要放置的物品名称 (字符串)',
      face: '放置面向 (字符串，可选)'
    };
  }
} 