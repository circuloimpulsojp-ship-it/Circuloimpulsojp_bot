const { Telegraf } = require("telegraf");
const fetch = require("node-fetch");

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("🔥 Bem-vindo ao Clube 5X!\n\nDigite seus 5 números entre 01 e 60 separados por espaço.");
});

bot.on("text", async (ctx) => {
  const numeros = ctx.message.text.split(" ").map(n => parseInt(n));

  if (numeros.length !== 5 || numeros.some(n => isNaN(n) || n < 1 || n > 60)) {
    return ctx.reply("❌ Digite 5 números válidos entre 01 e 60.");
  }

  try {
    await fetch(process.env.SHEETS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: process.env.SHEETS_API_KEY,
        numeros: numeros.join(" "),
        telegramId: ctx.from.id
      })
    });

    ctx.reply(`✅ Seus números foram registrados: ${numeros.join(", ")}`);

  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ Erro ao salvar. Tente novamente.");
  }
});

bot.launch();
console.log("Bot rodando...");
