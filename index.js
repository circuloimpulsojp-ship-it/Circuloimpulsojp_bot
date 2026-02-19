const { Telegraf } = require("telegraf");

// Node 18+ já tem fetch nativo. (Railway usa Node moderno)
const BOT_TOKEN = process.env.BOT_TOKEN;
const SHEETS_WEBAPP_URL = process.env.SHEETS_WEBAPP_URL;
const SHEETS_API_KEY = process.env.SHEETS_API_KEY;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN não configurado");
if (!SHEETS_WEBAPP_URL) throw new Error("SHEETS_WEBAPP_URL não configurado");
if (!SHEETS_API_KEY) throw new Error("SHEETS_API_KEY não configurado");

const bot = new Telegraf(BOT_TOKEN);

async function postToSheets(payload) {
  const res = await fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: SHEETS_API_KEY, ...payload }),
  });

  // Se o Apps Script não retornar JSON, isso pode falhar.
  // Então tentamos ler texto também:
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`Sheets HTTP ${res.status}: ${text}`);
  }

  // Se seu Apps Script retornar {ok:false}, tratamos também:
  if (data && data.ok === false) {
    throw new Error(`Sheets respondeu ok=false: ${text}`);
  }

  return data;
}

bot.start(async (ctx) => {
  await ctx.reply("🔥 Bem-vindo ao Clube 5X!\n\nDigite seus 6 números entre 01 e 60 separados por espaço.");
});

bot.on("text", async (ctx) => {
  try {
    const numeros = ctx.message.text.trim().split(/\s+/).map(n => parseInt(n, 10));

    if (numeros.length !== 6 || numeros.some(n => Number.isNaN(n) || n < 1 || n > 60)) {
      return ctx.reply("❌ Digite 6 números válidos entre 01 e 60. Ex: 10 22 35 44 59 01");
    }

    // exemplo de “weekKey” (opcional)
    const weekKey = new Date().toISOString().slice(0, 10);

    // salva aposta
    await postToSheets({
      type: "aposta",
      telegramId: String(ctx.from.id),
      username: ctx.from.username || "",
      nome: ctx.from.first_name || "",
      numeros: numeros.join(" "),
      weekKey,
    });

    return ctx.reply(`✅ Seus números foram registrados: ${numeros.join(", ")}`);
  } catch (err) {
    console.error(err);
    return ctx.reply("⚠️ Deu um erro ao salvar. Tente novamente em instantes.");
  }
});

bot.launch();
console.log("Bot rodando...");
