const { Telegraf, Markup } = require("telegraf");
const fetch = require("node-fetch"); // se preferir, dá pra remover e usar fetch nativo do Node 22

const BOT_TOKEN = process.env.BOT_TOKEN;
const SHEETS_WEBAPP_URL = process.env.SHEETS_WEBAPP_URL;
const SHEETS_API_KEY = process.env.SHEETS_API_KEY;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN não configurado");
if (!SHEETS_WEBAPP_URL) throw new Error("SHEETS_WEBAPP_URL não configurado");
if (!SHEETS_API_KEY) throw new Error("SHEETS_API_KEY não configurado");

const bot = new Telegraf(BOT_TOKEN);

// ====== CONFIG DO SEU SORTEIO ======
const CONFIG = {
  title: "🔥 Clube 5X",
  day: "Sábado",
  time: "20h",
  numbersCount: 6,
  min: 1,
  max: 60,
  oneBetPerWeek: true,
};

// ====== “BANCO” EM MEMÓRIA (pra sessão simples) ======
const session = new Map(); // key: telegramId -> { step, cadastro, referral }

// ====== UTIL ======
function getUserId(ctx) {
  return ctx.from?.id;
}

function getUsername(ctx) {
  return ctx.from?.username ? `@${ctx.from.username}` : "";
}

function getBotUser(ctx) {
  // Nem sempre disponível, mas normalmente funciona
  return ctx.me || "SEU_BOT";
}

function onlyDigits(s) {
  return (s || "").replace(/\D/g, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function parseNumbers(text) {
  const parts = String(text || "").trim().split(/\s+/);
  const nums = parts.map(p => parseInt(p, 10));
  return nums;
}

function validateNumbers(nums) {
  if (nums.length !== CONFIG.numbersCount) return false;
  if (nums.some(n => Number.isNaN(n) || n < CONFIG.min || n > CONFIG.max)) return false;
  // sem repetidos
  const set = new Set(nums);
  if (set.size !== nums.length) return false;
  return true;
}

function getWeekKey(date = new Date()) {
  // chave simples por ano-semana (UTC)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, "0")}`;
}

async function postToSheets(payload) {
  const res = await fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: SHEETS_API_KEY,
      ...payload,
    }),
  });

  // Se o Apps Script responder texto, tenta ler
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

  if (!res.ok) {
    throw new Error(`Sheets HTTP ${res.status}: ${txt}`);
  }
  if (data && data.ok === false) {
    throw new Error(`Sheets error: ${txt}`);
  }
  return data;
}

async function salvarCadastro({ telegramId, username, nome, telefone, cpf, email, referredBy }) {
  return postToSheets({
    type: "cadastro",
    telegramId,
    username,
    nome,
    telefone,
    cpf,
    email,
    referredBy: referredBy || "",
    createdAt: new Date().toISOString(),
  });
}

async function salvarAposta({ telegramId, nome, numeros }) {
  return postToSheets({
    type: "aposta",
    weekKey: getWeekKey(new Date()),
    telegramId,
    nome,
    numeros: numeros.join(" "),
    createdAt: new Date().toISOString(),
  });
}

// ====== MENU (painel estilo Group Help) ======
function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📝 Cadastrar", "MENU_CADASTRAR")],
    [Markup.button.callback("🎟 Fazer aposta (6 números)", "MENU_APOSTA")],
    [Markup.button.callback("🔗 Meu link de indicação", "MENU_LINK")],
    [Markup.button.callback("📊 Minhas apostas", "MENU_MINHAS")],
    [Markup.button.callback("ℹ️ Regras / Valores / Horário", "MENU_REGRAS")],
  ]);
}

function groupMenu(botUsername) {
  const dmLink = `https://t.me/${botUsername}`;
  return Markup.inlineKeyboard([
    [Markup.button.url("✅ Abrir no privado e começar", dmLink)],
    [Markup.button.callback("ℹ️ Regras", "MENU_REGRAS")],
  ]);
}

// ====== START ======
bot.start(async (ctx) => {
  const chatType = ctx.chat?.type; // private, group, supergroup
  const botUsername = getBotUser(ctx);

  // Captura referral via start payload: /start ref_123
  const text = ctx.message?.text || "";
  const payload = text.split(" ").slice(1).join(" ").trim();
  const userId = getUserId(ctx);

  let ref = "";
  if (payload && payload.startsWith("ref_")) {
    ref = payload.replace("ref_", "");
  }

  // Inicia sessão
  session.set(userId, {
    step: "MENU",
    cadastro: {},
    referral: ref,
  });

  // Se for grupo, manda “painel do grupo”
  if (chatType !== "private") {
    return ctx.reply(
      `👋 ${CONFIG.title}\n\nPara cadastrar e apostar, clique abaixo e fale comigo no privado:`,
      groupMenu(botUsername)
    );
  }

  // Privado: painel completo
  return ctx.reply(
    `${CONFIG.title}\n\nEscolha uma opção:`,
    mainMenu()
  );
});

// ====== HANDLERS DO MENU ======
bot.action("MENU_REGRAS", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply(
    `📌 *Regras do ${CONFIG.title}*\n\n` +
    `🗓 *Sorteio:* ${CONFIG.day} às ${CONFIG.time}\n` +
    `🎯 *Aposta:* ${CONFIG.numbersCount} números de ${CONFIG.min} a ${CONFIG.max} (sem repetir)\n` +
    `✅ *1 aposta por semana*\n\n` +
    `Use o menu para *Cadastrar* e depois *Fazer aposta*.`,
    { parse_mode: "Markdown" }
  );
});

bot.action("MENU_LINK", async (ctx) => {
  await ctx.answerCbQuery();
  const userId = getUserId(ctx);
  const botUsername = getBotUser(ctx);
  const link = `https://t.me/${botUsername}?start=ref_${userId}`;
  return ctx.reply(`🔗 Seu link de indicação:\n${link}\n\nEnvie para seus convidados. Quando eles derem /start pelo link, fica registrado como sua indicação.`);
});

bot.action("MENU_CADASTRAR", async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.chat?.type !== "private") {
    const botUsername = getBotUser(ctx);
    return ctx.reply("Para cadastrar, faça no privado:", groupMenu(botUsername));
  }
  const userId = getUserId(ctx);
  session.set(userId, { ...(session.get(userId) || {}), step: "CAD_NOME", cadastro: (session.get(userId)?.cadastro || {}) });
  return ctx.reply("📝 *Cadastro*\n\nDigite seu *Nome e Sobrenome* (ex: Bruno Alencar):", { parse_mode: "Markdown" });
});

bot.action("MENU_APOSTA", async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.chat?.type !== "private") {
    const botUsername = getBotUser(ctx);
    return ctx.reply("Para apostar, faça no privado:", groupMenu(botUsername));
  }
  const userId = getUserId(ctx);
  const s = session.get(userId) || { cadastro: {} };

  // Obriga cadastro antes
  if (!s.cadastro?.nome || !s.cadastro?.cpf || !s.cadastro?.email) {
    session.set(userId, { ...s, step: "CAD_NOME" });
    return ctx.reply("⚠️ Antes de apostar, você precisa se cadastrar.\n\nDigite seu *Nome e Sobrenome*:", { parse_mode: "Markdown" });
  }

  session.set(userId, { ...s, step: "APOSTA_NUMEROS" });
  return ctx.reply(
    `🎟 *Aposta da semana*\n\nDigite seus ${CONFIG.numbersCount} números entre ${CONFIG.min} e ${CONFIG.max} separados por espaço.\nEx: 01 03 10 49 55 60`,
    { parse_mode: "Markdown" }
  );
});

bot.action("MENU_MINHAS", async (ctx) => {
  await ctx.answerCbQuery();
  // (Simples: sem buscar na planilha agora. Podemos implementar consulta depois.)
  return ctx.reply("📊 Em breve: consulta de apostas direto na planilha.\nPor enquanto, as apostas são registradas automaticamente.");
});

// ====== FLUXO DE TEXTO (CADASTRO/APOSTA) ======
bot.on("text", async (ctx) => {
  // Se for grupo, ignora e manda pro privado
  if (ctx.chat?.type !== "private") return;

  const userId = getUserId(ctx);
  const s = session.get(userId) || { step: "MENU", cadastro:
