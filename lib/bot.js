const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { logInfo, logError } = require('./utils');
const { pathfinder, Movements } = require('./plugins/pathfinder/index');
const { readMemory, writeMemory, checkMemoryWritable } = require('./memory');
const loader = require('./loader');

if (process.argv.length > 6) {
  console.log('Usage : node main.js [<host>] [<port>] [<name>] [<password>]');
  process.exit(1);
}

const bot = mineflayer.createBot({
  host: process.argv[2] || 'localhost',
  port: parseInt(process.argv[3], 10) || 25565,
  username: process.argv[4] || 'ZMBot',
  password: process.argv[5],
});

bot.loadPlugin(pathfinder);
const modules = loader(bot);

bot.once('inject_allowed', () => {
  const mcData = minecraftData(bot.version);
  const defaultMove = new Movements(bot, mcData);
  defaultMove.canDig = false;
  bot.mcData = mcData;
  bot.pathfinder.setMovements(defaultMove);
});

async function saveMemory() {
  const readMemoryPromises = modules.map((x) => writeMemory(x));
  await Promise.allSettled(readMemoryPromises);
  logInfo('memory serialized');
}

async function initModule() {
  await checkMemoryWritable();
  const readMemoryPromises = modules.map((x) => readMemory(x));
  await Promise.allSettled(readMemoryPromises);
  for (const module of modules) {
    module.init && module.init();
  }
  logInfo('module initialized');
  process.on('SIGINT', async () => {
    bot.quit('user abored');
    await saveMemory();
    process.exit(0);
  });
}

bot.once('spawn', () => {
  initModule();
  logInfo('ZMBot online');
  bot.chat('ZMBot已上线');
});

bot.on('error', (error) => {
  logError(error);
});

bot.on('chat', async (username, message) => {
  if (username === bot.username || username === 'you') return;
  const target = bot.players[username] ? bot.players[username].entity : null;
  console.log('[chat]', username, ':', message);

  if (message === 'save') {
    await saveMemory();
  }

  if (message === 'poweroff') {
    await saveMemory();
    bot.chat('Bye!');
    bot.quit('Bot exit.');
    process.exit(0);
  }

  for (const module of modules.values()) {
    const args = message.split(' ');
    try {
      if (module.prefix === '') {
        await module.chat(args, target);
      } else if (module.prefix === args[0]) {
        await module.chat(args.splice(1), target);
      }
    } catch (err) {
      bot.chat(err.message);
    }
  }
});

module.exports = bot;
