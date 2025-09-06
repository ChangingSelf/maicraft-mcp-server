import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { MovementUtils, GoalType } from './MovementUtils.js';
import { Logger } from './Logger.js';
import { BaseActionParams } from '../minecraft/ActionInterface.js';

/**
 * 放置方块参数接口
 */
export interface PlaceBlockParams extends BaseActionParams {
  x: number;
  y: number;
  z: number;
  block: string;
  face?: string;
  useRelativeCoords?: boolean;
}

/**
 * 放置方块结果接口
 */
export interface PlaceBlockResult {
  /** 是否成功 */
  success: boolean;
  /** 方块名称 */
  block: string;
  /** 放置位置 */
  position: {
    x: number;
    y: number;
    z: number;
  };
  /** 参照方块名称 */
  referenceBlock: string;
  /** 放置面向 */
  face: string;
  /** 是否使用相对坐标 */
  useRelativeCoords: boolean;
  /** 错误信息（如果有） */
  error?: string;
  /** 详细状态描述 */
  message: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 放置方块工具类
 * 提供统一的方块放置功能，基于 mineflayer
 */
export class PlaceBlockUtils {
  private static logger = new Logger('PlaceBlockUtils');

  /**
   * 在指定位置放置方块
   */
  static async placeBlock(
    bot: Bot,
    params: PlaceBlockParams
  ): Promise<PlaceBlockResult> {
    try {
      // 检查 mcData
      const mcData = bot.registry;
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

      // 根据useRelativeCoords参数确定坐标类型
      let position: Vec3;
      if (params.useRelativeCoords) {
        // 相对坐标（相对于bot当前位置）
        const botPos = bot.entity.position;
        position = new Vec3(
          Math.floor(botPos.x) + params.x,
          Math.floor(botPos.y) + params.y,
          Math.floor(botPos.z) + params.z
        );
      } else {
        // 绝对坐标
        position = new Vec3(params.x, params.y, params.z);
      }

      // 检查目标位置是否已经有方块
      const targetBlock = bot.blockAt(position);
      if (targetBlock && targetBlock.name !== 'air') {
        return this.createErrorResult(`目标位置已有方块: ${targetBlock.name}`, 'POSITION_OCCUPIED');
      }

      // 检查bot身体是否占据目标位置（bot高2格）
      const botPosition = bot.entity.position;
      const botFloorPos = new Vec3(Math.floor(botPosition.x), Math.floor(botPosition.y), Math.floor(botPosition.z));
      const botHeadPos = botFloorPos.offset(0, 1, 0); // bot头部位置（向上1格）

      const isBotOccupyingTarget =
        (botFloorPos.x === position.x && botFloorPos.z === position.z && botFloorPos.y === position.y) ||
        (botHeadPos.x === position.x && botHeadPos.z === position.z && botHeadPos.y === position.y);

      if (isBotOccupyingTarget) {
        // 尝试移动到周围位置以让出目标位置
        const relocationResult = await this.tryRelocateBot(bot, position);
        if (!relocationResult.success) {
          return this.createErrorResult(`bot占据目标位置，尝试移动失败: ${relocationResult.error}`, 'BOT_OCCUPYING_POSITION');
        }

        // 移动后再次检查是否仍然占据
        const newBotPosition = bot.entity.position;
        const newBotFloorPos = new Vec3(Math.floor(newBotPosition.x), Math.floor(newBotPosition.y), Math.floor(newBotPosition.z));
        const newBotHeadPos = newBotFloorPos.offset(0, 1, 0);

        const stillOccupying =
          (newBotFloorPos.x === position.x && newBotFloorPos.z === position.z && newBotFloorPos.y === position.y) ||
          (newBotHeadPos.x === position.x && newBotHeadPos.z === position.z && newBotHeadPos.y === position.y);

        if (stillOccupying) {
          return this.createErrorResult(`移动后bot仍然占据目标位置，无法放置方块`, 'STILL_OCCUPYING_POSITION');
        }
      }

      // 查找参照方块和放置方向
      const faceVectors = [
        new Vec3(0, 1, 0),   // +y
        new Vec3(0, -1, 0),  // -y
        new Vec3(1, 0, 0),   // +x
        new Vec3(-1, 0, 0),  // -x
        new Vec3(0, 0, 1),   // +z
        new Vec3(0, 0, -1),  // -z
      ];

      let referenceBlock: any = null;
      let faceVector: Vec3 | null = null;

      // 如果指定了face参数，优先使用指定的方向
      if (params.face) {
        const faceMap: { [key: string]: Vec3 } = {
          '+y': new Vec3(0, 1, 0),
          '-y': new Vec3(0, -1, 0),
          '+x': new Vec3(1, 0, 0),
          '-x': new Vec3(-1, 0, 0),
          '+z': new Vec3(0, 0, 1),
          '-z': new Vec3(0, 0, -1),
        };

        const specifiedFace = faceMap[params.face];
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
        // 根据faceVector确定合适的facing方向
        const getFacingFromFaceVector = (faceVec: Vec3): 'north' | 'east' | 'south' | 'west' | 'up' | 'down' => {
          // faceVector表示从目标位置到参照方块的方向
          // 我们需要确定机器人应该朝哪个方向看才能看到参照方块
          if (faceVec.x === 1) return 'west';   // 参照方块在东边，朝西看
          if (faceVec.x === -1) return 'east';  // 参照方块在西边，朝东看
          if (faceVec.z === 1) return 'north';  // 参照方块在南边，朝北看
          if (faceVec.z === -1) return 'south'; // 参照方块在北边，朝南看
          if (faceVec.y === 1) return 'down';   // 参照方块在上方，朝下看
          if (faceVec.y === -1) return 'up';    // 参照方块在下方，朝上看
          return 'up'; // 默认值
        };

        const facing = getFacingFromFaceVector(faceVector);

        // 使用统一的移动工具类移动到目标位置，使用 GoalPlaceBlock 目标类型
        const moveResult = await MovementUtils.moveTo(
          bot,
          {
            type: 'coordinate',
            x: position.x,
            y: position.y,
            z: position.z,
            distance: 4, // 到达距离
            maxDistance: 100, // 最大移动距离
            useRelativeCoords: false, // 不使用相对坐标
            goalType: GoalType.GoalPlaceBlock,
            placeBlockOptions: {
              referencePosition: referenceBlock.position,
              faceVector: faceVector,
              options: {
                range: 4.5,
                LOS: true,
                faces: [faceVector], // 只使用找到的放置面向
                facing: facing
              }
            }
          }
        );

        if (!moveResult.success) {
          this.logger.warn(`移动到目标位置失败: ${moveResult.error}，尝试直接放置`);
        }

        // 装备物品
        await bot.equip(item, 'hand');

        // 放置方块
        await bot.placeBlock(referenceBlock, faceVector);

        // 只要没有抛出错误，就认为放置成功
        return this.createSuccessResult(`成功放置 ${params.block}`, {
          block: params.block,
          position: { x: position.x, y: position.y, z: position.z },
          referenceBlock: referenceBlock.name,
          face: params.face || 'auto',
          useRelativeCoords: params.useRelativeCoords || false
        });

      } catch (error) {
        return this.createExceptionResult(error, `放置 ${params.block} 失败`, 'PLACE_FAILED');
      }

    } catch (error) {
      return this.createExceptionResult(error, '放置方块失败', 'PLACE_FAILED');
    }
  }

  /**
   * 创建错误结果
   */
  private static createErrorResult(message: string, errorCode: string): PlaceBlockResult {
    return {
      success: false,
      block: '',
      position: { x: 0, y: 0, z: 0 },
      referenceBlock: '',
      face: '',
      useRelativeCoords: false,
      error: errorCode,
      message,
      timestamp: Date.now()
    };
  }

  /**
   * 创建异常结果
   */
  private static createExceptionResult(error: any, message: string, errorCode: string): PlaceBlockResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      block: '',
      position: { x: 0, y: 0, z: 0 },
      referenceBlock: '',
      face: '',
      useRelativeCoords: false,
      error: errorCode,
      message: `${message}: ${errorMessage}`,
      timestamp: Date.now()
    };
  }

  /**
   * 创建成功结果
   */
  private static createSuccessResult(message: string, data: {
    block: string;
    position: { x: number; y: number; z: number };
    referenceBlock: string;
    face: string;
    useRelativeCoords: boolean;
  }): PlaceBlockResult {
    return {
      success: true,
      ...data,
      message,
      timestamp: Date.now()
    };
  }

  /**
   * 尝试移动bot到周围位置以让出目标位置
   */
  private static async tryRelocateBot(bot: Bot, targetPosition: Vec3): Promise<{ success: boolean; error?: string }> {
    const logger = new Logger('PlaceBlockUtils');

    // 定义周围的位置偏移（前后左右各1格）
    const offsets = [
      new Vec3(1, 0, 0),   // 东
      new Vec3(-1, 0, 0),  // 西
      new Vec3(0, 0, 1),   // 南
      new Vec3(0, 0, -1),  // 北
      new Vec3(1, 0, 1),   // 东南
      new Vec3(1, 0, -1),  // 东北
      new Vec3(-1, 0, 1),  // 西南
      new Vec3(-1, 0, -1), // 西北
    ];

    for (const offset of offsets) {
      const newPosition = targetPosition.plus(offset);

      try {
        // 检查新位置是否安全（有地面支撑且上方有空间）
        const groundBlock = bot.blockAt(newPosition.offset(0, -1, 0));
        const newPosBlock = bot.blockAt(newPosition);
        const headPosBlock = bot.blockAt(newPosition.offset(0, 1, 0));

        // 确保地面有支撑且新位置和头部位置都是空气
        if (groundBlock && groundBlock.name !== 'air' &&
            newPosBlock && newPosBlock.name === 'air' &&
            headPosBlock && headPosBlock.name === 'air') {

          logger.info(`尝试移动到位置: (${newPosition.x}, ${newPosition.y}, ${newPosition.z})`);

          // 使用MovementUtils移动到新位置
          const moveResult = await MovementUtils.moveTo(bot, {
            type: 'coordinate',
            x: newPosition.x,
            y: newPosition.y,
            z: newPosition.z,
            distance: 0.1, // 非常接近目标位置
            maxDistance: 10, // 限制移动距离
            goalType: GoalType.GoalNearXZ
          });

          if (moveResult.success) {
            logger.info(`成功移动到新位置让出目标位置`);
            return { success: true };
          } else {
            logger.warn(`移动到 (${newPosition.x}, ${newPosition.y}, ${newPosition.z}) 失败: ${moveResult.error}`);
          }
        }
      } catch (error) {
        logger.warn(`移动到 (${newPosition.x}, ${newPosition.y}, ${newPosition.z}) 时发生异常: ${error}`);
      }
    }

    return { success: false, error: '所有周围位置都无法移动到' };
  }
}