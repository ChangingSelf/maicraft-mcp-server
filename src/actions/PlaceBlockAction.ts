import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import minecraftData from 'minecraft-data';
import { z } from 'zod';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';

interface PlaceBlockParams extends BaseActionParams {
  x: number;
  y: number;
  z: number;
  block: string;
  face?: string;
  useAbsoluteCoords?: boolean;
}

export class PlaceBlockAction extends BaseAction<PlaceBlockParams> {
  name = 'placeBlock';
  description = '在指定位置放置方块';
  schema = z.object({
    x: z.number().describe('目标位置X坐标 (数字)'),
    y: z.number().describe('目标位置Y坐标 (数字)'),
    z: z.number().describe('目标位置Z坐标 (数字)'),
    block: z.string().describe('要放置的方块名称 (字符串)'),
    face: z.string().optional().describe('放置面向 (字符串，可选): up(上方), down(下方), north(北方), south(南方), east(东方), west(西方)'),
    useAbsoluteCoords: z.boolean().optional().describe('是否使用绝对坐标 (布尔值，可选，默认false为相对坐标)'),
  });

  // 校验和参数描述由基类通过 schema 自动生成

  async execute(bot: Bot, params: PlaceBlockParams): Promise<ActionResult> {
    try {
      // 检查 mcData
      const mcData = minecraftData(bot.version);
      if (!mcData) {
        return this.createErrorResult('mcData 未加载，请检查 mineflayer 版本', 'MCDATA_NOT_LOADED');
      }

      const blockByName = mcData.blocksByName[params.block];
      if (!blockByName) {
        return this.createErrorResult(`未找到方块: ${params.block}`, 'BLOCK_NOT_FOUND');
      }

      // 在背包中查找对应的物品
      const itemByName = mcData.itemsByName[params.block];
      if (!itemByName) {
        return this.createErrorResult(`未找到对应的物品: ${params.block}`, 'ITEM_NOT_FOUND');
      }

      // 在背包中查找物品
      const item = bot.inventory.findInventoryItem(itemByName.id, null, false);
      if (!item) {
        return this.createErrorResult(`背包中没有 ${params.block}`, 'ITEM_NOT_IN_INVENTORY');
      }

      const itemCount = item.count;
      
      // 根据useAbsoluteCoords参数确定坐标类型
      let position: Vec3;
      if (params.useAbsoluteCoords) {
        // 绝对坐标
        position = new Vec3(params.x, params.y, params.z);
      } else {
        // 相对坐标（相对于bot当前位置）
        const botPos = bot.entity.position;
        position = new Vec3(
          botPos.x + params.x,
          botPos.y + params.y,
          botPos.z + params.z
        );
      }

      // 检查目标位置是否已经有方块
      const targetBlock = bot.blockAt(position);
      if (targetBlock && targetBlock.name !== 'air') {
        return this.createErrorResult(`目标位置已有方块: ${targetBlock.name}`, 'POSITION_OCCUPIED');
      }

      // 查找参照方块和放置方向
      const faceVectors = [
        new Vec3(0, 1, 0),   // up
        new Vec3(0, -1, 0),  // down
        new Vec3(1, 0, 0),   // east
        new Vec3(-1, 0, 0),  // west
        new Vec3(0, 0, 1),   // south
        new Vec3(0, 0, -1),  // north
      ];

      let referenceBlock: any = null;
      let faceVector: Vec3 | null = null;

      // 如果指定了face参数，优先使用指定的方向
      if (params.face) {
        const faceMap: { [key: string]: Vec3 } = {
          'up': new Vec3(0, 1, 0),
          'down': new Vec3(0, -1, 0),
          'east': new Vec3(1, 0, 0),
          'west': new Vec3(-1, 0, 0),
          'south': new Vec3(0, 0, 1),
          'north': new Vec3(0, 0, -1),
        };
        
        const specifiedFace = faceMap[params.face.toLowerCase()];
        if (specifiedFace) {
          const block = bot.blockAt(position.minus(specifiedFace));
          if (block && block.name !== 'air') {
            referenceBlock = block;
            faceVector = specifiedFace;
          }
        }
      }

      // 如果没有找到参照方块，尝试所有方向
      if (!referenceBlock) {
        for (const vector of faceVectors) {
          const block = bot.blockAt(position.minus(vector));
          if (block && block.name !== 'air') {
            referenceBlock = block;
            faceVector = vector;
            this.logger.info(`找到参照方块: ${block.name} 在位置 ${block.position}`);
            break;
          }
        }
      }

      if (!referenceBlock || !faceVector) {
        return this.createErrorResult(`无法找到有效的参照方块来放置 ${params.block}。无法放置悬浮方块，请移动到可以放置 ${params.block} 的位置`, 'NO_REFERENCE_BLOCK');
      }

      // 尝试放置方块
      try {
        // 如果路径查找器可用，移动到目标位置
        if (bot.pathfinder?.goto) {
          try {
            const { GoalNear } = pathfinder.goals;
            if (GoalNear) {
              const goal = new GoalNear(position.x, position.y, position.z, 4);
              await bot.pathfinder.goto(goal);
            }
          } catch (pathError) {
            this.logger.warn('移动到目标位置失败，尝试直接放置', pathError);
          }
        }

        // 装备物品
        await bot.equip(item, 'hand');
        
        // 放置方块
        await bot.placeBlock(referenceBlock, faceVector);

        // 检查是否成功放置
        const newItem = bot.inventory.findInventoryItem(itemByName.id, null, false);
        if (newItem && newItem.count === itemCount) {
          return this.createErrorResult(`放置 ${params.block} 失败，请尝试其他位置`, 'PLACE_FAILED');
        }

        return this.createSuccessResult(`成功放置 ${params.block}`, { 
          block: params.block, 
          position: { x: position.x, y: position.y, z: position.z },
          referenceBlock: referenceBlock.name,
          face: params.face || 'auto',
          useAbsoluteCoords: params.useAbsoluteCoords || false
        });

      } catch (error) {
        // 检查物品数量是否减少来判断是否成功放置
        const newItem = bot.inventory.findInventoryItem(itemByName.id, null, false);
        if (newItem && newItem.count < itemCount) {
          return this.createSuccessResult(`成功放置 ${params.block}`, { 
            block: params.block, 
            position: { x: position.x, y: position.y, z: position.z },
            referenceBlock: referenceBlock.name,
            face: params.face || 'auto',
            useAbsoluteCoords: params.useAbsoluteCoords || false
          });
        }
        
        return this.createExceptionResult(error, `放置 ${params.block} 失败`, 'PLACE_FAILED');
      }

    } catch (error) {
      return this.createExceptionResult(error, '放置方块失败', 'PLACE_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: place_block）
}