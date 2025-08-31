/*
Minecraft 第一视角截图视图管理器
用于在其他项目中方便地生成和获取 Minecraft 世界的截图
支持多种输出格式：JPG、PNG、base64
*/

import * as mineflayer from 'mineflayer'
import prismarineViewer from 'prismarine-viewer'
import * as fs from 'fs'
import * as path from 'path'
import { createCanvas } from 'node-canvas-webgl/lib/index.js'
import * as THREE from 'three'
import { Worker } from 'worker_threads'
// 设置全局对象
global.THREE = THREE
;(global as any).Worker = Worker

const { Viewer, WorldView, getBufferFromStream } = prismarineViewer.viewer

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
      const botPosition = () => {
        this.viewer.setFirstPersonCamera(bot.entity.position, bot.entity.yaw, bot.entity.pitch)
        this.worldView.updatePosition(bot.entity.position)
      }

      // 等待世界渲染完成
      await this.viewer.world.waitForChunksToRender()

      // 注册事件监听器
      bot.on('move', botPosition)
      this.worldView.listenToBot(bot)

      // 等待世界完全加载
      await new Promise(resolve => setTimeout(resolve, this.options.loadWaitTime))

      // 进行渲染循环以确保材质正确加载
      await this.performRenderLoops()

      this.isInitialized = true
      console.log('Minecraft视图管理器初始化完成')

    } catch (error) {
      console.error('视图管理器初始化失败:', error)
      throw error
    }
  }

  /**
   * 执行渲染循环以确保材质正确加载
   */
  private async performRenderLoops(): Promise<void> {
    for (let i = 0; i < this.options.renderLoops; i++) {
      this.viewer.update()
      this.renderer.render(this.viewer.scene, this.viewer.camera)

      // 短暂延迟让纹理加载
      await new Promise(resolve => setTimeout(resolve, 100))
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
      // 更新相机位置（处理机器人可能的移动）
      this.viewer.setFirstPersonCamera(this.bot.entity.position, this.bot.entity.yaw, this.bot.entity.pitch)
      this.worldView.updatePosition(this.bot.entity.position)

      // 最终渲染
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
