/*
Minecraft 第一视角截图视图管理器
用于在其他项目中方便地生成和获取 Minecraft 世界的截图
支持多种输出格式：JPG、PNG、base64
*/

import * as mineflayer from 'mineflayer'
import prismarineViewer from 'prismarine-viewer'
import * as fs from 'fs'
import * as path from 'path'
import { createCanvas } from 'node-canvas-webgl/lib'
import * as THREE from 'three'
import { Worker } from 'worker_threads'
// 设置全局对象
global.THREE = THREE
;(global as any).Worker = Worker

// 导入prismarine-viewer组件
const { Viewer, WorldView, getBufferFromStream } = (prismarineViewer as any).viewer

/**
 * Minecraft 视图管理器配置选项
 */
export interface ViewerOptions {
  /** 视野距离（区块数量） */
  viewDistance?: number
  /** 图片宽度 */
  width?: number
  /** 图片高度 */
  height?: number
  /** JPG 质量 (0-100) */
  jpgQuality?: number
  /** 世界加载等待时间（毫秒） */
  loadWaitTime?: number
  /** 渲染循环次数 */
  renderLoops?: number
}

/**
 * Minecraft 第一视角截图视图管理器
 * 用于生成和获取 Minecraft 世界的截图
 */
export class ViewerManager {
  private bot: any = null
  private viewer: any = null
  private worldView: any = null
  private renderer: any = null
  private canvas: any = null
  private isInitialized = false
  private positionUpdateTimer: NodeJS.Timeout | null = null

  private options: Required<ViewerOptions> = {
    viewDistance: 12,
    width: 1920,
    height: 1080,
    jpgQuality: 95,
    loadWaitTime: 2000,
    renderLoops: 10
  }

  /**
   * 创建视图管理器实例
   * @param options 配置选项
   */
  constructor(options: ViewerOptions = {}) {
    this.options = { ...this.options, ...options }
  }

  /**
   * 初始化视图管理器
   * @param bot Mineflayer 机器人实例
   */
  async initialize(bot: any): Promise<void> {
    if (this.isInitialized) {
      throw new Error('视图管理器已经初始化过了')
    }

    this.bot = bot

    try {
      // 创建canvas和renderer
      this.canvas = createCanvas(this.options.width, this.options.height)
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas })
      this.viewer = new Viewer(this.renderer)

      // 设置版本
      if (!this.viewer.setVersion(bot.version)) {
        throw new Error(`不支持的Minecraft版本: ${bot.version}`)
      }

      // 设置第一视角相机
      this.viewer.setFirstPersonCamera(bot.entity.position, bot.entity.yaw, bot.entity.pitch)

      // 加载世界视图
      this.worldView = new WorldView(bot.world, this.options.viewDistance, bot.entity.position)
      this.viewer.listen(this.worldView)
      this.worldView.init(bot.entity.position)  // 不使用 await，与官方一致

      // 创建位置更新函数
      const updatePosition = () => {
        if (this.bot && this.bot.entity && this.bot.entity.position) {
          try {
            const position = this.bot.entity.position
            const yaw = this.bot.entity.yaw
            const pitch = this.bot.entity.pitch

            // 只有在位置数据有效时才更新
            this.viewer.setFirstPersonCamera(position, yaw, pitch)
            this.worldView.updatePosition(position)
          } catch (error) {
            console.warn('[ViewerManager] 位置更新失败:', error instanceof Error ? error.message : String(error))
          }
        }
      }

      // 移除定时器，完全依赖按需更新位置
      // 每次截图前都会强制同步位置

      // 注册世界视图事件监听器
      this.worldView.listenToBot(bot)

      // 立即执行一次位置更新
      updatePosition()

      // 等待世界渲染完成（减少等待时间）
      await Promise.race([
        this.viewer.world.waitForChunksToRender(),
        new Promise(resolve => setTimeout(resolve, 1000)) // 最多等待1秒
      ])

      // 减少等待时间
      await new Promise(resolve => setTimeout(resolve, Math.min(this.options.loadWaitTime, 500)))

      // 减少渲染循环次数
      await this.performRenderLoops(Math.min(this.options.renderLoops, 3))

      this.isInitialized = true
      console.log('Minecraft视图管理器初始化完成')

    } catch (error) {
      console.error('视图管理器初始化失败:', error)
      throw error
    }
  }

  /**
   * 执行渲染循环以确保材质正确加载
   * @param loops 循环次数，可选，默认使用配置值
   */
  private async performRenderLoops(loops?: number): Promise<void> {
    const loopCount = loops || this.options.renderLoops
    for (let i = 0; i < loopCount; i++) {
      this.viewer.update()
      this.renderer.render(this.viewer.scene, this.viewer.camera)

      // 短暂延迟让纹理加载
      await new Promise(resolve => setTimeout(resolve, 50)) // 减少到50ms
    }
  }

  /**
   * 获取第一视角截图
   * @param format 输出格式
   * @returns 截图数据
   */
  async takeScreenshot(format: 'jpg' | 'png' | 'base64' = 'jpg'): Promise<string | Buffer> {
    if (!this.isInitialized) {
      throw new Error('视图管理器未初始化，请先调用 initialize()')
    }

    try {
      // 每次截图前都强制同步机器人当前位置
      this.forceSyncPosition()

      // 再次渲染确保位置更新生效
      this.viewer.update()
      this.renderer.render(this.viewer.scene, this.viewer.camera)

      if (format === 'base64') {
        // 生成base64编码的图片
        const dataUrl = this.canvas.toDataURL('image/png')
        return dataUrl
      } else {
        // 生成图片缓冲区
        let imageStream
        if (format === 'png') {
          imageStream = this.canvas.createPNGStream()
        } else {
          imageStream = this.canvas.createJPEGStream({
            quality: this.options.jpgQuality / 100,
            progressive: false
          })
        }

        const buffer = await getBufferFromStream(imageStream)
        return buffer
      }

    } catch (error) {
      console.error('截图生成失败:', error)
      throw error
    }
  }

  /**
   * 获取第一视角截图并保存为文件
   * @param format 输出格式
   * @param outputPath 输出文件路径（可选，默认使用当前目录的 screenshots 文件夹）
   * @returns 保存的文件路径
   */
  async takeScreenshotToFile(format: 'jpg' | 'png' = 'jpg', outputPath?: string): Promise<string> {
    const screenshotData = await this.takeScreenshot(format)

    if (typeof screenshotData === 'string') {
      // base64 格式，直接返回数据
      return screenshotData
    }

    // Buffer 格式，保存为文件
    const defaultPath = path.join(process.cwd(), 'screenshots', `screenshot_${Date.now()}.${format}`)
    const filePath = outputPath || defaultPath

    // 确保目录存在
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    await fs.promises.writeFile(filePath, screenshotData)
    return filePath
  }

  /**
   * 强制同步相机位置到机器人当前位置
   * 用于处理传送等特殊情况，每次截图前都会调用此方法
   */
  forceSyncPosition(): void {
    if (!this.isInitialized || !this.bot || !this.bot.entity) {
      console.warn('[ViewerManager] 无法强制同步位置：未初始化或机器人不存在')
      return
    }

    try {
      const position = this.bot.entity.position
      const yaw = this.bot.entity.yaw
      const pitch = this.bot.entity.pitch

      // 验证位置数据
      if (!position || typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number') {
        console.warn('[ViewerManager] 位置数据无效，跳过同步')
        return
      }

      // 调试日志（只在位置变化时输出）
      const currentPos = this.viewer.camera?.position
      const posChanged = !currentPos ||
        Math.abs(currentPos.x - position.x) > 0.01 ||
        Math.abs(currentPos.y - position.y) > 0.01 ||
        Math.abs(currentPos.z - position.z) > 0.01

      if (posChanged) {
        console.log(`[ViewerManager] 同步相机位置: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}), 朝向: yaw=${yaw?.toFixed(2)}, pitch=${pitch?.toFixed(2)}`)
      }

      // 更新相机位置
      this.viewer.setFirstPersonCamera(position, yaw, pitch)
      this.worldView.updatePosition(position)

      // 立即渲染确保位置更新生效
      this.viewer.update()
      this.renderer.render(this.viewer.scene, this.viewer.camera)

    } catch (error) {
      console.error('[ViewerManager] 强制同步位置失败:', error instanceof Error ? error.message : String(error))
      // 即使同步失败，也继续执行，不抛出异常
    }
  }

  /**
   * 更新视图管理器的配置
   * @param options 新的配置选项
   */
  updateOptions(options: Partial<ViewerOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * 销毁视图管理器，释放资源
   */
  destroy(): void {
    if (this.positionUpdateTimer) {
      // 清理定时器
      clearInterval(this.positionUpdateTimer)
      this.positionUpdateTimer = null
    }

    if (this.bot) {
      // 移除事件监听器
      this.bot.removeAllListeners('move')
    }

    // 清理资源
    this.viewer = null
    this.worldView = null
    this.renderer = null
    this.canvas = null
    this.bot = null
    this.isInitialized = false

    console.log('Minecraft视图管理器已销毁')
  }

  /**
   * 检查视图管理器是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized
  }

  /**
   * 获取当前配置
   */
  getOptions(): Readonly<ViewerOptions> {
    return { ...this.options }
  }
}
