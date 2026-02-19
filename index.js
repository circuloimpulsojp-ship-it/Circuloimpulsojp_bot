const fetch = require("node-fetch");

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
async function salvarCadastro(data) {
  await fetch(process.env.SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: process.env.SHEETS_API_KEY,
      type: "cadastro",
      ...data
    })
  });
}

async function salvarAposta(data) {
  await fetch(process.env.SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: process.env.SHEETS_API_KEY,
      type: "aposta",
      ...data
    })
  });
}
await salvarCadastro({
  telegramId: userId,
  username: msg.from.username || "",
  nome: ses.data.name,
  telefone: ses.data.phone,
  cpf: ses.data.cpf,
  email: ses.data.email,
  referredBy: ses.data.referredBy || ""
});
await salvarAposta({
  weekKey: getWeekKey(new Date()),
  telegramId: userId,
  nome: ses.data.name,
  numeros: numeros.join(" ")
});
