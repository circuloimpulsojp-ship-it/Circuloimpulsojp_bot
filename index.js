const { Telegraf } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN não configurado!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("🔥 Bot funcionando! Digite seus 5 números.");
});

bot.on("text", (ctx) => {
  ctx.reply("Recebi sua mensagem: " + ctx.message.text);
});

bot.launch()
  .then(() => {
    console.log("🤖 Bot iniciado com sucesso!");
  })
  .catch((err) => {
    console.error("Erro ao iniciar:", err);
  });

// Mantém o processo vivo (importante no Railway)
process.on("SIGINT", () => bot.stop("SIGINT"));
process.on("SIGTERM", () => bot.stop("SIGTERM"));

setInterval(() => {
  console.log("Bot rodando...");
}, 30000);
