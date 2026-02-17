const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("🔥 Bem-vindo ao Clube 5X!\n\nDigite seus 5 números entre 01 e 60 separados por espaço.");
});

bot.on('text', (ctx) => {
  const numeros = ctx.message.text.split(" ").map(n => parseInt(n));

  if (numeros.length !== 5 || numeros.some(n => isNaN(n) || n < 1 || n > 60)) {
    return ctx.reply("❌ Digite 5 números válidos entre 01 e 60.");
  }

  ctx.reply(`✅ Seus números foram registrados: ${numeros.join(", ")}`);
});

bot.launch();
