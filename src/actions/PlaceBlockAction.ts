import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { PlaceBlockUtils, PlaceBlockParams } from '../utils/PlaceBlockUtils.js';


export class PlaceBlockAction extends BaseAction<PlaceBlockParams> {
  name = 'placeBlock';
  description = '在指定位置放置方块';
  schema = z.object({
    x: z.number().int().describe('目标位置X坐标 (整数)'),
    y: z.number().int().describe('目标位置Y坐标 (整数)'),
    z: z.number().int().describe('目标位置Z坐标 (整数)'),
    block: z.string().describe('要放置的方块名称 (字符串)'),
    face: z.string().optional().describe('放置面向 (字符串，可选): +y, -y, +z, -z, +x, -x'),
    useRelativeCoords: z.boolean().optional().describe('是否使用相对坐标 (布尔值，可选，默认false为绝对坐标)'),
  });

  // 校验和参数描述由基类通过 schema 自动生成

  async execute(bot: Bot, params: PlaceBlockParams): Promise<ActionResult> {
    try {
      // 调用统一的放置方块工具类
      const result = await PlaceBlockUtils.placeBlock(bot, params);

      if (result.success) {
        return this.createSuccessResult(result.message, {
          block: result.block,
          position: result.position,
          referenceBlock: result.referenceBlock,
          face: result.face,
          useRelativeCoords: result.useRelativeCoords
        });
      } else {
        return this.createErrorResult(result.message, result.error || 'PLACE_FAILED');
      }

    } catch (error) {
      return this.createExceptionResult(error, '放置方块失败', 'PLACE_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: place_block）
}