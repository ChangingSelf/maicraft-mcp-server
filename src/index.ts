import mineflayer from 'mineflayer'
import { mineflayer as mineflayerViewer } from 'prismarine-viewer'
import { pathfinder, Movements } from 'mineflayer-pathfinder'
import pathfinderPkg from 'mineflayer-pathfinder'
const { goals } = pathfinderPkg
import minecraftData from 'minecraft-data'


const bot = mineflayer.createBot({
  host: '127.0.0.1',
  port: 11451,
  username: 'Mai'
})

bot.loadPlugin(pathfinder)

bot.once('spawn', () => {
  mineflayerViewer(bot, { firstPerson: true, port: 3000 })

  // const mcData = minecraftData(bot.version)
  const defaultMove = new Movements(bot)
  bot.pathfinder.setMovements(defaultMove)
  bot.pathfinder.setGoal(new goals.GoalXZ(1000, 0))
})