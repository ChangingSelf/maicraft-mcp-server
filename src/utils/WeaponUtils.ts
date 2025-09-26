import { Bot } from 'mineflayer';
import { Entity } from 'prismarine-entity';

/**
 * 武器工具类
 * 提供武器管理和生物类型检测功能
 */
export class WeaponUtils {
  
  /**
   * 飞行生物列表
   */
  private static readonly FLYING_MOBS = new Set([
    'phantom',      // 幻翼
    'bat',          // 蝙蝠
    'bee',          // 蜜蜂
    'parrot',       // 鹦鹉
    'vex',          // 恼鬼
    'allay',        // 悦灵
    'wither',       // 凋零
    'ghast',        // 恶魂
    'blaze',        // 烈焰人
    'ender_dragon', // 末影龙
  ]);

  /**
   * 远程武器列表（按优先级排序）
   */
  private static readonly RANGED_WEAPONS = [
    'bow',              // 弓
    'crossbow',         // 弩
    'trident',          // 三叉戟
    'snowball',         // 雪球
    'egg',              // 鸡蛋
    'ender_pearl',      // 末影珍珠
    'splash_potion',    // 喷溅药水
  ];

  /**
   * 近战武器列表（按优先级排序）
   */
  private static readonly MELEE_WEAPONS = [
    // 剑类（最高优先级）
    'netherite_sword',
    'diamond_sword',
    'iron_sword',
    'golden_sword',
    'stone_sword',
    'wooden_sword',
    // 斧类
    'netherite_axe',
    'diamond_axe',
    'iron_axe',
    'golden_axe',
    'stone_axe',
    'wooden_axe',
    // 其他工具
    'netherite_pickaxe',
    'diamond_pickaxe',
    'iron_pickaxe',
    'trident', // 三叉戟也可以近战
  ];

  /**
   * 检测生物是否为飞行生物
   */
  static isFlyingMob(mobName: string): boolean {
    return this.FLYING_MOBS.has(mobName.toLowerCase());
  }

  /**
   * 检测实体是否为飞行生物
   */
  static isFlyingEntity(entity: Entity): boolean {
    if (!entity || !entity.name) {
      return false;
    }
    return this.isFlyingMob(entity.name);
  }

  /**
   * 获取背包中最佳的远程武器
   */
  static getBestRangedWeapon(bot: Bot): any | null {
    const inventory = bot.inventory.items();
    
    for (const weaponName of this.RANGED_WEAPONS) {
      const weapon = inventory.find(item => item.name === weaponName);
      if (weapon) {
        return weapon;
      }
    }
    
    return null;
  }

  /**
   * 获取背包中最佳的近战武器
   */
  static getBestMeleeWeapon(bot: Bot): any | null {
    const inventory = bot.inventory.items();
    
    for (const weaponName of this.MELEE_WEAPONS) {
      const weapon = inventory.find(item => item.name === weaponName);
      if (weapon) {
        return weapon;
      }
    }
    
    return null;
  }

  /**
   * 装备最佳远程武器
   */
  static async equipBestRangedWeapon(bot: Bot): Promise<{ success: boolean; weapon: any | null; message: string }> {
    const weapon = this.getBestRangedWeapon(bot);
    
    if (!weapon) {
      return {
        success: false,
        weapon: null,
        message: '背包中没有找到可用的远程武器'
      };
    }

    try {
      // 如果当前手持的不是目标武器，切换到该武器
      if (!bot.heldItem || bot.heldItem.type !== weapon.type) {
        await bot.equip(weapon.type, 'hand');
      }
      
      return {
        success: true,
        weapon: weapon,
        message: `成功装备远程武器: ${weapon.name}`
      };
    } catch (error) {
      return {
        success: false,
        weapon: null,
        message: `装备远程武器失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 装备最佳近战武器
   */
  static async equipBestMeleeWeapon(bot: Bot): Promise<{ success: boolean; weapon: any | null; message: string }> {
    const weapon = this.getBestMeleeWeapon(bot);
    
    if (!weapon) {
      return {
        success: false,
        weapon: null,
        message: '背包中没有找到可用的近战武器'
      };
    }

    try {
      // 如果当前手持的不是目标武器，切换到该武器
      if (!bot.heldItem || bot.heldItem.type !== weapon.type) {
        await bot.equip(weapon.type, 'hand');
      }
      
      return {
        success: true,
        weapon: weapon,
        message: `成功装备近战武器: ${weapon.name}`
      };
    } catch (error) {
      return {
        success: false,
        weapon: null,
        message: `装备近战武器失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 检查远程武器是否需要弹药
   */
  static needsAmmo(weaponName: string): boolean {
    return weaponName === 'bow' || weaponName === 'crossbow';
  }

  /**
   * 检查是否有足够的弹药
   */
  static hasAmmo(bot: Bot, weaponName: string): boolean {
    if (!this.needsAmmo(weaponName)) {
      return true; // 不需要弹药的武器总是可用
    }

    const inventory = bot.inventory.items();
    const arrow = inventory.find(item => item.name === 'arrow');
    return arrow ? arrow.count > 0 : false;
  }

  /**
   * 获取实体的高度信息（用于判断是否在空中）
   */
  static getEntityHeight(entity: Entity): number {
    if (!entity || !entity.position) {
      return 0;
    }
    return entity.position.y;
  }

  /**
   * 判断实体是否在空中（相对于地面）
   */
  static isEntityInAir(bot: Bot, entity: Entity, threshold: number = 3): boolean {
    if (!entity || !entity.position) {
      return false;
    }

    try {
      // 检查实体下方是否有方块
      const entityPos = entity.position;
      const blockBelow = bot.blockAt(entityPos.offset(0, -1, 0));
      
      if (!blockBelow || blockBelow.name === 'air') {
        // 继续向下检查更多方块
        for (let i = 2; i <= threshold + 2; i++) {
          const checkBlock = bot.blockAt(entityPos.offset(0, -i, 0));
          if (checkBlock && checkBlock.name !== 'air') {
            return false; // 找到了地面
          }
        }
        return true; // 下方都是空气，认为在空中
      }
      
      return false; // 直接下方有方块，不在空中
    } catch (error) {
      // 如果检查失败，保守地返回false
      return false;
    }
  }

  /**
   * 计算攻击距离
   */
  static getAttackDistance(entity: Entity, isRanged: boolean): number {
    if (!isRanged) {
      return 3; // 近战攻击距离
    }

    // 远程攻击距离根据目标类型调整
    if (this.isFlyingEntity(entity)) {
      return 20; // 飞行生物保持更远距离
    }
    
    return 15; // 普通远程攻击距离
  }

  /**
   * 检查是否应该使用远程攻击
   */
  static shouldUseRangedAttack(bot: Bot, entity: Entity): boolean {
    // 如果是飞行生物，优先使用远程攻击
    if (this.isFlyingEntity(entity)) {
      return true;
    }

    // 如果目标在空中且高度超过阈值，使用远程攻击
    if (this.isEntityInAir(bot, entity, 5)) {
      return true;
    }

    // 如果距离较远，使用远程攻击
    const distance = entity.position.distanceTo(bot.entity.position);
    if (distance > 10) {
      return true;
    }

    return false;
  }
}
