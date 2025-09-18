import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Entity } from 'prismarine-entity';


/**
 * Minecraft 游戏工具类
 * 提供各种 Minecraft 游戏相关的工具方法
 */
export class MinecraftUtils {
  /**
   * 计算护甲值
   */
  static getArmorValue(bot: Bot): number {
    try {
      let totalArmor = 0;
      const armorSlots = ['head', 'torso', 'legs', 'feet'];
      
      armorSlots.forEach(slot => {
        const item = bot.inventory.slots[bot.getEquipmentDestSlot(slot)];
        if (item && item.name && item.name !== 'air') {
          // 计算护甲值，这里使用简化映射
          const armorValues = {
            // 皮革盔甲
            'leather_helmet': 1, 'leather_chestplate': 3, 'leather_leggings': 2, 'leather_boots': 1,
            // 锁链盔甲
            'chainmail_helmet': 2, 'chainmail_chestplate': 5, 'chainmail_leggings': 4, 'chainmail_boots': 1,
            // 铁盔甲
            'iron_helmet': 2, 'iron_chestplate': 6, 'iron_leggings': 5, 'iron_boots': 2,
            // 钻石盔甲
            'diamond_helmet': 3, 'diamond_chestplate': 8, 'diamond_leggings': 6, 'diamond_boots': 3,
            // 下界合金盔甲
            'netherite_helmet': 3, 'netherite_chestplate': 8, 'netherite_leggings': 6, 'netherite_boots': 3,
            // 金盔甲
            'golden_helmet': 2, 'golden_chestplate': 5, 'golden_leggings': 3, 'golden_boots': 1,
            // 海龟壳
            'turtle_helmet': 2
          };
          totalArmor += armorValues[item.name as keyof typeof armorValues] || 0;
        }
      });
      
      return totalArmor;
    } catch (error) {
      console.warn('Error calculating armor value:', error);
      return 0;
    }
  }

  /**
   * 获取生物群系信息
   */
  static getBiome(bot: Bot): any {
    const mcData = bot.registry;
    try {
      const block = bot.blockAt(bot.entity.position);
      if (block && block.biome) {
        return mcData.biomes[block.biome.id];
      }
      return 0;
    } catch (error) {
      console.warn('Error getting biome id:', error);
      return 0;
    }
  }

  /**
   * 检查是否能看到天空
   */
  static canSeeSky(bot: Bot): boolean {
    try {
      const pos = bot.entity.position;
      const startY = Math.floor(pos.y) + 1;
      const maxY = bot.game.dimension === 'overworld' ? 320 :
                  bot.game.dimension === 'the_nether' ? 128 : 256;

      for (let y = startY; y < maxY; y++) {
        const blockAbove = bot.blockAt(new Vec3(Math.floor(pos.x), y, Math.floor(pos.z)));
        if (blockAbove && blockAbove.name !== 'air' && !blockAbove.transparent) {
          return false;
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 执行带消息过滤的操作
   * @param bot Bot 实例
   * @param operation 要执行的操作函数
   * @param filterMessages 要过滤的消息数组
   * @param delayCleanup 延迟清理过滤器的毫秒数，默认200ms（解决异步消息发送的时序问题）
   * @returns 操作结果
   */
  static async executeWithMessageFilter<T>(
    bot: Bot,
    operation: () => Promise<T>,
    filterMessages: string[] = [],
    delayCleanup: number = 200
  ): Promise<T> {
    // 保存原始的 chat 方法
    const originalChat = bot.chat;

    // 创建过滤版本的 chat 方法
    const filteredChat = (message: string) => {
      // 检查是否是要过滤的消息
      if (filterMessages.includes(message)) {
        console.debug(`已过滤消息: ${message}`);
        return;
      }
      // 其他消息正常发送
      originalChat.call(bot, message);
    };

    // 临时替换 chat 方法
    bot.chat = filteredChat;

    // 标记是否已清理，避免重复清理
    let cleanedUp = false;

    // 清理函数
    const cleanup = () => {
      if (!cleanedUp) {
        cleanedUp = true;
        bot.chat = originalChat;
      }
    };

    try {
      // 执行操作
      const result = await operation();

      // 延迟清理，确保异步消息也能被过滤
      setTimeout(cleanup, delayCleanup);

      return result;
    } catch (error) {
      // 立即清理，不延迟（异常情况下不需要等待异步消息）
      cleanup();
      throw error;
    }
  }

  /**
   * 将 prismarine-entity.Entity 对象映射为标准化的实体数据结构
   * 用于事件处理器中复用实体信息映射逻辑
   * @param entity 要映射的实体对象
   * @returns 映射后的实体数据
   */
  static mapEntity(entity: Entity): any {
    return {
      id: entity.id,
      uuid: entity.uuid,
      type: entity.type,
      name: entity.name,
      username: entity.username,
      count: entity.count,
      position: {
        x: Number(entity.position.x.toFixed(2)),
        y: Number(entity.position.y.toFixed(2)),
        z: Number(entity.position.z.toFixed(2))
      },
      health: entity.health,
      food: entity.food
    };
  }
}
