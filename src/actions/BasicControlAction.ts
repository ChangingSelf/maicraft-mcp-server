import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { MovementUtils } from '../utils/MovementUtils.js';

/**
 * 基础控制参数接口
 */
interface BasicControlParams extends BaseActionParams {
  /** 控制类型 */
  type: 'toss' | 'move' | 'jump' | 'sneak' | 'look_at' | 'sleep' | 'wake' | 'stop_move' | 'stop_sneak';
  /** 物品名称或ID (用于丢弃物品) */
  item?: string;
  /** 物品数量 (用于丢弃物品，默认 1) */
  count?: number;
  /** 移动方向 (用于移动控制: forward, back, left, right) */
  direction?: 'forward' | 'back' | 'left' | 'right';

  /** 注视类型 (用于 look_at 操作) */
  lookType?: 'angle' | 'position' | 'player' | 'entity' | 'block';
  /** 视角偏航角，弧度 (用于 angle 注视类型) */
  yaw?: number;
  /** 视角俯仰角，弧度 (用于 angle 注视类型) */
  pitch?: number;
  /** 目标坐标 X (用于 position 注视类型) */
  x?: number;
  /** 目标坐标 Y (用于 position 注视类型) */
  y?: number;
  /** 目标坐标 Z (用于 position 注视类型) */
  z?: number;
  /** 是否强制看向 (用于所有注视类型，默认 false) */
  force?: boolean;
  /** 目标玩家名称 (用于 player 注视类型) */
  player?: string;
  /** 目标实体类型 (用于 entity 注视类型) */
  entity?: string;
  /** 目标方块名称 (用于 block 注视类型) */
  block?: string;
  /** 搜索距离 (用于 entity 和 block 注视类型，默认 64) */
  maxDistance?: number;
}

/**
 * BasicControlAction - 基础控制动作
 * 提供基本的游戏控制功能，让 bot 能够像普通玩家一样操作游戏
 *
 * 支持的控制操作：
 * - toss: 丢弃物品
 * - move: 移动控制 (前进、后退、左移、右移)
 * - jump: 跳跃
 * - sneak: 潜行
 * - look_at: 注视控制，支持以下注视类型：
 *   - angle: 调整视角到指定的偏航角和俯仰角
 *   - position: 看向指定的坐标位置
 *   - player: 看向指定的玩家
 *   - entity: 看向指定类型的实体 (如 cow, pig, zombie)
 *   - block: 看向指定类型的方块 (如 dirt, stone, diamond_ore)
 * - sleep: 睡觉，会自动寻找附近的床并睡觉
 * - wake: 醒来，从床上起来
 * - stop_move: 停止所有移动
 * - stop_sneak: 停止潜行
 */
export class BasicControlAction extends BaseAction<BasicControlParams> {
  name = 'basic_control';
  description = '提供基础的游戏控制功能，包括移动、跳跃、潜行、视角调整和物品丢弃';

  schema = z.object({
    type: z.enum(['toss', 'move', 'jump', 'sneak', 'look_at', 'sleep', 'wake', 'stop_move', 'stop_sneak']).describe('控制类型 (toss | move | jump | sneak | look_at | sleep | wake | stop_move | stop_sneak)'),
    item: z.string().optional().describe('物品名称或ID (用于 toss 类型)'),
    count: z.number().int().positive().optional().describe('物品数量 (用于 toss 类型，默认 1)'),
    direction: z.enum(['forward', 'back', 'left', 'right']).optional().describe('移动方向 (用于 move 类型：forward | back | left | right)'),

    lookType: z.enum(['angle', 'position', 'player', 'entity', 'block']).optional().describe('注视类型 (用于 look_at 类型：angle | position | player | entity | block)'),
    yaw: z.number().optional().describe('视角偏航角，弧度 (用于 angle 注视类型)'),
    pitch: z.number().optional().describe('视角俯仰角，弧度 (用于 angle 注视类型)'),
    x: z.number().optional().describe('目标坐标 X (用于 position 注视类型)'),
    y: z.number().optional().describe('目标坐标 Y (用于 position 注视类型)'),
    z: z.number().optional().describe('目标坐标 Z (用于 position 注视类型)'),
    force: z.boolean().optional().describe('是否强制看向 (用于所有注视类型，默认 false)'),
    player: z.string().optional().describe('目标玩家名称 (用于 player 注视类型)'),
    entity: z.string().optional().describe('目标实体类型 (用于 entity 注视类型)，例如 cow, pig, zombie 等'),
    block: z.string().optional().describe('目标方块名称 (用于 block 注视类型)，例如 dirt, stone, diamond_ore 等'),
    maxDistance: z.number().positive().optional().describe('搜索距离 (用于 entity 和 block 注视类型，默认 64)')
  });

  async execute(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    try {
      switch (params.type) {
        case 'toss':
          return await this.handleToss(bot, params);
        case 'move':
          return await this.handleMove(bot, params);
        case 'jump':
          return await this.handleJump(bot, params);
        case 'sneak':
          return await this.handleSneak(bot, params);
        case 'look_at':
          return await this.handleLookAt(bot, params);
        case 'sleep':
          return await this.handleSleep(bot, params);
        case 'wake':
          return await this.handleWake(bot, params);
        case 'stop_move':
          return await this.handleStopMove(bot, params);
        case 'stop_sneak':
          return await this.handleStopSneak(bot, params);
        default:
          return this.createErrorResult(`不支持的控制类型: ${params.type}`, 'UNSUPPORTED_TYPE');
      }
    } catch (error) {
      this.logger.error(`基础控制失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '基础控制失败', 'CONTROL_FAILED');
    }
  }

  /**
   * 处理丢弃物品
   */
  private async handleToss(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    const { item, count = 1 } = params;

    if (!item) {
      return this.createErrorResult('丢弃物品需要指定 item 参数', 'MISSING_ITEM');
    }

    try {
      // 查找物品
      const itemToToss = bot.inventory.findInventoryItem(bot.registry.itemsByName[item]?.id || parseInt(item), null, false);
      if (!itemToToss) {
        return this.createErrorResult(`未找到物品: ${item}`, 'ITEM_NOT_FOUND');
      }

      // 检查物品数量是否足够
      if (itemToToss.count < count) {
        return this.createErrorResult(`物品数量不足，需要 ${count} 个，实际有 ${itemToToss.count} 个`, 'INSUFFICIENT_QUANTITY');
      }

      // 丢弃物品
      await bot.toss(bot.registry.itemsByName[item]?.id || parseInt(item), null, count);

      return this.createSuccessResult(`已成功丢弃 ${count} 个 ${item}`, {
        item: item,
        count: count,
        remaining: itemToToss.count - count
      });
    } catch (error) {
      return this.createExceptionResult(error, '丢弃物品失败', 'TOSS_FAILED');
    }
  }

  /**
   * 处理移动控制
   */
  private async handleMove(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    const { direction } = params;

    if (!direction) {
      return this.createErrorResult('移动控制需要指定 direction 参数', 'MISSING_DIRECTION');
    }

    try {
      // 设置移动状态
      bot.setControlState(direction, true);

      return this.createSuccessResult(`已开始向 ${this.getDirectionName(direction)} 移动`, {
        direction: direction,
        state: 'started'
      });
    } catch (error) {
      return this.createExceptionResult(error, '移动控制失败', 'MOVE_FAILED');
    }
  }

  /**
   * 处理跳跃
   */
  private async handleJump(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    try {
      // 执行跳跃
      bot.setControlState('jump', true);

      // 短暂延迟后停止跳跃，以模拟真实的跳跃动作
      setTimeout(() => {
        try {
          bot.setControlState('jump', false);
        } catch (error) {
          this.logger.warn('停止跳跃失败:', error);
        }
      }, 200); // 200ms 后停止跳跃

      return this.createSuccessResult('已执行跳跃动作', {
        action: 'jump',
        duration: '200ms'
      });
    } catch (error) {
      return this.createExceptionResult(error, '跳跃失败', 'JUMP_FAILED');
    }
  }

  /**
   * 处理潜行
   */
  private async handleSneak(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    try {
      bot.setControlState('sneak', true);

      return this.createSuccessResult('已开始潜行', {
        action: 'sneak',
        state: 'started'
      });
    } catch (error) {
      return this.createExceptionResult(error, '潜行失败', 'SNEAK_FAILED');
    }
  }

  /**
   * 处理注视控制 (合并了所有注视相关操作)
   */
  private async handleLookAt(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    const { lookType, force = false } = params;

    if (!lookType) {
      return this.createErrorResult('注视操作需要指定 lookType 参数', 'MISSING_LOOK_TYPE');
    }

    switch (lookType) {
      case 'angle':
        return await this.handleLookAngle(bot, params);
      case 'position':
        return await this.handleLookPosition(bot, params);
      case 'player':
        return await this.handleLookPlayer(bot, params);
      case 'entity':
        return await this.handleLookEntity(bot, params);
      case 'block':
        return await this.handleLookBlock(bot, params);
      default:
        return this.createErrorResult(`不支持的注视类型: ${lookType}`, 'UNSUPPORTED_LOOK_TYPE');
    }
  }

  /**
   * 处理调整视角角度
   */
  private async handleLookAngle(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    const { yaw, pitch, force } = params;

    if (yaw === undefined || pitch === undefined) {
      return this.createErrorResult('调整视角角度需要指定 yaw 和 pitch 参数', 'MISSING_YAW_PITCH');
    }

    try {
      await bot.look(yaw, pitch, force);

      return this.createSuccessResult(`已调整视角到偏航角: ${yaw.toFixed(2)}, 俯仰角: ${pitch.toFixed(2)}`, {
        yaw: yaw,
        pitch: pitch,
        force: force
      });
    } catch (error) {
      return this.createExceptionResult(error, '调整视角角度失败', 'LOOK_ANGLE_FAILED');
    }
  }

  /**
   * 处理看向坐标位置
   */
  private async handleLookPosition(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    const { x, y, z, force } = params;

    if (x === undefined || y === undefined || z === undefined) {
      return this.createErrorResult('看向位置需要指定 x, y, z 参数', 'MISSING_COORDINATES');
    }

    try {
      const targetPos = new Vec3(x, y, z);
      await bot.lookAt(targetPos, force);

      return this.createSuccessResult(`已看向位置 (${x}, ${y}, ${z})`, {
        position: { x, y, z },
        force: force
      });
    } catch (error) {
      return this.createExceptionResult(error, '看向位置失败', 'LOOK_POSITION_FAILED');
    }
  }

  /**
   * 处理停止移动
   */
  private async handleStopMove(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    try {
      // 停止所有移动方向
      bot.setControlState('forward', false);
      bot.setControlState('back', false);
      bot.setControlState('left', false);
      bot.setControlState('right', false);

      return this.createSuccessResult('已停止所有移动', {
        action: 'stop_move',
        directions: ['forward', 'back', 'left', 'right']
      });
    } catch (error) {
      return this.createExceptionResult(error, '停止移动失败', 'STOP_MOVE_FAILED');
    }
  }

  /**
   * 处理停止潜行
   */
  private async handleStopSneak(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    try {
      bot.setControlState('sneak', false);

      return this.createSuccessResult('已停止潜行', {
        action: 'stop_sneak',
        state: 'stopped'
      });
    } catch (error) {
      return this.createExceptionResult(error, '停止潜行失败', 'STOP_SNEAK_FAILED');
    }
  }

  /**
   * 处理看向玩家
   */
  private async handleLookPlayer(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    const { player, force = false } = params;

    if (!player) {
      return this.createErrorResult('看向玩家需要指定 player 参数', 'MISSING_PLAYER');
    }

    try {
      const targetPlayer = bot.players[player];
      if (!targetPlayer || !targetPlayer.entity) {
        return this.createErrorResult(`未找到玩家 ${player}，请确保其在附近`, 'PLAYER_NOT_FOUND');
      }

      await bot.lookAt(targetPlayer.entity.position, force);

      return this.createSuccessResult(`已看向玩家 ${player}`, {
        player: player,
        position: {
          x: targetPlayer.entity.position.x,
          y: targetPlayer.entity.position.y,
          z: targetPlayer.entity.position.z
        },
        force: force
      });
    } catch (error) {
      return this.createExceptionResult(error, '看向玩家失败', 'LOOK_PLAYER_FAILED');
    }
  }

  /**
   * 处理看向实体
   */
  private async handleLookEntity(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    const { entity, force = false, maxDistance = 64 } = params;

    if (!entity) {
      return this.createErrorResult('看向实体需要指定 entity 参数', 'MISSING_ENTITY');
    }

    try {
      const targetEntity = bot.nearestEntity((e: any) =>
        e.name?.toLocaleLowerCase() === entity.toLocaleLowerCase()
      );

      if (!targetEntity) {
        return this.createErrorResult(`附近未找到 ${entity} 类型的实体`, 'ENTITY_NOT_FOUND');
      }

      // 检查距离
      const distance = bot.entity.position.distanceTo(targetEntity.position);
      if (distance > maxDistance) {
        return this.createErrorResult(`目标实体距离过远 (${distance.toFixed(2)} > ${maxDistance})`, 'ENTITY_TOO_FAR');
      }

      await bot.lookAt(targetEntity.position, force);

      return this.createSuccessResult(`已看向 ${entity} 类型实体`, {
        entity: entity,
        position: {
          x: targetEntity.position.x,
          y: targetEntity.position.y,
          z: targetEntity.position.z
        },
        distance: distance,
        force: force
      });
    } catch (error) {
      return this.createExceptionResult(error, '看向实体失败', 'LOOK_ENTITY_FAILED');
    }
  }

  /**
   * 处理看向方块
   */
  private async handleLookBlock(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    const { block, force = false, maxDistance = 64 } = params;

    if (!block) {
      return this.createErrorResult('看向方块需要指定 block 参数', 'MISSING_BLOCK');
    }

    try {
      const mcData = bot.registry;
      const blockByName = mcData.blocksByName[block];
      if (!blockByName) {
        return this.createErrorResult(`未找到名为 ${block} 的方块`, 'BLOCK_NOT_FOUND');
      }

      const blockPositions = bot.findBlocks({
        matching: [blockByName.id],
        maxDistance: maxDistance,
        count: 1
      });

      if (blockPositions.length === 0) {
        return this.createErrorResult(`附近未找到 ${block} 方块`, 'BLOCK_NOT_FOUND_NEARBY');
      }

      const blockPos = blockPositions[0];
      const targetPosition = new Vec3(blockPos.x, blockPos.y, blockPos.z);

      // 检查距离
      const distance = bot.entity.position.distanceTo(targetPosition);
      if (distance > maxDistance) {
        return this.createErrorResult(`目标方块距离过远 (${distance.toFixed(2)} > ${maxDistance})`, 'BLOCK_TOO_FAR');
      }

      await bot.lookAt(targetPosition, force);

      return this.createSuccessResult(`已看向 ${block} 方块`, {
        block: block,
        position: {
          x: targetPosition.x,
          y: targetPosition.y,
          z: targetPosition.z
        },
        distance: distance,
        force: force
      });
    } catch (error) {
      return this.createExceptionResult(error, '看向方块失败', 'LOOK_BLOCK_FAILED');
    }
  }

  /**
   * 处理睡觉
   */
  private async handleSleep(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    try {
      // 检查是否已经在睡觉
      if (bot.isSleeping) {
        return this.createSuccessResult('已经躺在床上睡觉了', {
          status: 'already_sleeping'
        });
      }

      // 寻找附近的床
      const bedBlock = this.findNearbyBed(bot);

      if (!bedBlock) {
        return this.createErrorResult('附近没有找到可用的床', 'NO_BED_FOUND');
      }

      // 检查床是否可用
      if (!bot.isABed(bedBlock)) {
        return this.createErrorResult('找到的方块不是床', 'INVALID_BED');
      }

      // 移动到床边
      const bedPos = bedBlock.position;
      const moveResult = await this.moveToBed(bot, bedPos);

      if (!moveResult.success) {
        return this.createErrorResult(`无法移动到床边: ${moveResult.error}`, 'CANNOT_REACH_BED');
      }

      // 睡觉
      await bot.sleep(bedBlock);

      return this.createSuccessResult('已成功躺在床上睡觉', {
        bedPosition: {
          x: bedPos.x,
          y: bedPos.y,
          z: bedPos.z
        },
        status: 'sleeping'
      });
    } catch (error) {
      return this.createExceptionResult(error, '睡觉失败', 'SLEEP_FAILED');
    }
  }

  /**
   * 处理醒来
   */
  private async handleWake(bot: Bot, params: BasicControlParams): Promise<ActionResult> {
    try {
      // 检查是否在睡觉
      if (!bot.isSleeping) {
        return this.createSuccessResult('当前没有在睡觉', {
          status: 'not_sleeping'
        });
      }

      // 醒来
      await bot.wake();

      return this.createSuccessResult('已成功从床上醒来', {
        status: 'awake'
      });
    } catch (error) {
      return this.createExceptionResult(error, '醒来失败', 'WAKE_FAILED');
    }
  }

  /**
   * 寻找附近的床
   */
  private findNearbyBed(bot: Bot): any {
    // 搜索范围内的床
    const maxDistance = 100;
    const beds = bot.findBlocks({
      matching: (block: any) => {
        return block.name === 'bed' ||
               block.name === 'white_bed' ||
               block.name === 'orange_bed' ||
               block.name === 'magenta_bed' ||
               block.name === 'light_blue_bed' ||
               block.name === 'yellow_bed' ||
               block.name === 'lime_bed' ||
               block.name === 'pink_bed' ||
               block.name === 'gray_bed' ||
               block.name === 'light_gray_bed' ||
               block.name === 'cyan_bed' ||
               block.name === 'purple_bed' ||
               block.name === 'blue_bed' ||
               block.name === 'brown_bed' ||
               block.name === 'green_bed' ||
               block.name === 'red_bed' ||
               block.name === 'black_bed';
      },
      maxDistance: maxDistance,
      count: 1
    });

    if (beds.length === 0) {
      return null;
    }

    return bot.blockAt(beds[0]);
  }

  /**
   * 移动到床边
   */
  private async moveToBed(bot: Bot, bedPos: Vec3): Promise<{success: boolean, error?: string}> {
    try {
      await MovementUtils.moveToCoordinate(bot, bedPos.x, bedPos.y, bedPos.z, 2, 100);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取方向名称的中文描述
   */
  private getDirectionName(direction: string): string {
    const directionNames: Record<string, string> = {
      'forward': '前方',
      'back': '后方',
      'left': '左侧',
      'right': '右侧'
    };
    return directionNames[direction] || direction;
  }
}
