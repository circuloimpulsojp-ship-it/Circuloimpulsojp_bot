const { Telegraf, session } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Escolha 1: variáveis em inglês (recomendado)
const SHEETS_WEBAPP_URL = process.env.SHEETS_WEBAPP_URL;
const SHEETS_API_KEY = process.env.SHEETS_API_KEY;

// Escolha 2 (se quiser manter em português no Railway), descomente:
// const SHEETS_WEBAPP_URL = process.env.URL_DO_APLICATIVO_WEBA_DE_PLANILHAS;
// const SHEETS_API_KEY = process.env.CHAVE_API_DO_SHEETS;

if (!process.env.BOT_TOKEN) throw new Error("BOT_TOKEN não configurado");
if (!SHEETS_WEBAPP_URL || !SHEETS_API_KEY) throw new Error("SHEETS_WEBAPP_URL / SHEETS_API_KEY não configurado");

bot.use(session());

function getWeekKey(date = new Date()) {
  // Ex: 2026-W07 (sem depender de PT-BR)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function postToSheets(payload) {
  const res = await fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: SHEETS_API_KEY, ...payload }),
  });

  // seu Apps Script pode não retornar JSON, então só garanta status ok
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sheets HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

bot.start(async (ctx) => {
  ctx.session.step = "numeros";
  await ctx.reply("🔥 Bem-vindo ao Clube 5X!\n\nDigite seus 6 números entre 01 e 60 separados por espaço.");
});

bot.on("text", async (ctx) => {
  try {
    const text = ctx.message.text.trim();

    // Ignorar comandos
    if (text.startsWith("/")) return;

    const numeros = text.split(/\s+/).map(n => parseInt(n, 10));

    if (numeros.length !== 6 || numeros.some(n => Number.isNaN(n) || n < 1 || n > 60)) {
      return ctx.reply("❌ Digite 6 números válidos entre 01 e 60.");
    }

    // salvar aposta
    await postToSheets({
      type: "aposta",
      weekKey: getWeekKey(new Date()),
      telegramId: String(ctx.from.id),
      username: ctx.from.username || "",
      nome: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim(),
      numeros: numeros.join(" "),
      createdAt: new Date().toISOString(),
    });

    return ctx.reply(`✅ Seus números foram registrados: ${numeros.join(", ")}`);
  } catch (err) {
    console.error(err);
    return ctx.reply("⚠️ Erro ao salvar. Tente novamente.");
  }
});

bot.launch();

process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
