import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams } from '../minecraft/ActionInterface.js';
import minecraftData from 'minecraft-data';
import { z } from 'zod';

interface PlaceBlockParams extends BaseActionParams {
  x: number;
  y: number;
  z: number;
  item: string;
  face?: string;
}

export class PlaceBlockAction extends BaseAction<PlaceBlockParams> {
  name = 'placeBlock';
  description = '在指定位置放置方块';
  schema = z.object({
    x: z.number().describe('目标位置X坐标 (数字)'),
    y: z.number().describe('目标位置Y坐标 (数字)'),
    z: z.number().describe('目标位置Z坐标 (数字)'),
    item: z.string().describe('要放置的物品名称 (字符串)'),
    face: z.string().optional().describe('放置面向 (字符串，可选)'),
  });

  // 校验和参数描述由基类通过 schema 自动生成

  async execute(bot: Bot, params: PlaceBlockParams): Promise<any> {
    try {
      const position = { x: params.x, y: params.y, z: params.z } as any;
      const referenceBlock = bot.blockAt(position);

      if (!referenceBlock) {
        return this.createErrorResult(`位置 (${params.x}, ${params.y}, ${params.z}) 无效`, 'INVALID_POSITION');
      }

      // 检查 mcData
      const mcData = minecraftData(bot.version);
      if (!mcData) {
        return this.createErrorResult('mcData 未加载，请检查 mineflayer 版本', 'MCDATA_NOT_LOADED');
      }

      const item = mcData.itemsByName[params.item];
      if (!item) {
        return this.createErrorResult(`未找到物品: ${params.item}`, 'ITEM_NOT_FOUND');
      }

      // 在背包中查找物品
      const itemInInventory = bot.inventory.items().find(i => i.type === item.id);
      if (!itemInInventory) {
        return this.createErrorResult(`背包中没有 ${params.item}`, 'ITEM_NOT_IN_INVENTORY');
      }

      // 装备物品
      await bot.equip(itemInInventory, 'hand');

      // 默认向上方放置
      const faceVector = { x: 0, y: 1, z: 0 } as any;
      await bot.placeBlock(referenceBlock, faceVector);

      return this.createSuccessResult(`成功放置方块: ${params.item}`, { item: params.item, position });
    } catch (error) {
      return this.createExceptionResult(error, '放置方块失败', 'PLACE_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: place_block）
}