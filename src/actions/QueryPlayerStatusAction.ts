import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { MinecraftUtils } from '../utils/MinecraftUtils.js';

interface QueryPlayerStatusParams extends BaseActionParams {
  includeInventory?: boolean;
}

export class QueryPlayerStatusAction extends BaseAction<QueryPlayerStatusParams> {
  name = 'queryPlayerStatus';
  description = '查询Bot自身的状态信息，包括位置、生命值、经验、饱食度、物品栏、装备栏等';
  schema = z.object({
    includeInventory: z.boolean().optional().default(false).describe('是否包含物品栏信息，默认不包含'),
  });

  /**
   * 获取指定装备槽位的物品信息
   */
  private getEquipmentItem(bot: Bot, slotName: string) {
    const slot = bot.getEquipmentDestSlot(slotName);
    const item = bot.inventory.slots[slot];
    return item && item.name !== 'air' ? {
      name: item.name,
      count: item.count,
      curDurability: item.maxDurability - item.durabilityUsed,
      maxDurability: item.maxDurability,
      durabilityPercentage: Number(((item.maxDurability - item.durabilityUsed) / item.maxDurability * 100).toFixed(1)),
      enchantments: item.enchants,
    } : null;
  }

  async execute(bot: Bot, params: QueryPlayerStatusParams): Promise<ActionResult> {
    try {
      this.logger.info('查询Bot自身状态信息');

      const gameModeMap: Record<number, string> = {
        0: 'survival',
        1: 'creative',
        2: 'adventure',
        3: 'spectator',
      }

      const biome = MinecraftUtils.getBiome(bot);
      const result: any = {
        username: bot.player.username,
        gamemode: gameModeMap[bot.player.gamemode],
        position: {
          x: Number(bot.entity.position.x.toFixed(2)),
          y: Number(bot.entity.position.y.toFixed(2)),
          z: Number(bot.entity.position.z.toFixed(2))
        },
        biome: biome.name,
        health: {
          current: bot.health,
          max: 20,
          percentage: (bot.health / 20) * 100
        },
        
        experience: {
          points: bot.experience.points,
          level: bot.experience.level,
          progress: bot.experience.progress
        },
        food: {
          current: bot.food,
          max: 20,
          saturation: bot.foodSaturation,
          percentage: (bot.food / 20) * 100
        },
        oxygen: Number(bot.oxygenLevel.toFixed(2)),
        armor: MinecraftUtils.getArmorValue(bot),
      
        isSleeping: bot.isSleeping,
        
        // 装备栏
        equipment: {
          head: this.getEquipmentItem(bot, 'head'),
          chest: this.getEquipmentItem(bot, 'torso'),
          legs: this.getEquipmentItem(bot, 'legs'),
          feet: this.getEquipmentItem(bot, 'feet'),
          offhand: this.getEquipmentItem(bot, 'off-hand')
        },
        
      };

      // 根据参数决定是否包含物品栏信息
      if (params.includeInventory) {
        result.inventory = {
          fullSlotCount: (bot.inventory.inventoryEnd - bot.inventory.inventoryStart) - bot.inventory.emptySlotCount(),
          emptySlotCount: bot.inventory.emptySlotCount(),
          slotCount: (bot.inventory.inventoryEnd - bot.inventory.inventoryStart),
          slots: bot.inventory.items().map(item => ({
            slot: item.slot,
            count: item.count,
            name: item.name,
          })),
        };
      }

      this.logger.info('成功查询Bot状态信息');
      return this.createSuccessResult('成功查询Bot状态信息', result);
    } catch (error) {
      this.logger.error(`查询Bot状态失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询Bot状态失败', 'QUERY_PLAYER_STATUS_FAILED');
    }
  }
}
