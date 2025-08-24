import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

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
        const biome = mcData.biomes[block.biome.id];
        return biome;
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
}
