const fetch = require("node-fetch");
const { Telegraf, session } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

function onlyDigits(str) {
  return (str || "").replace(/\D/g, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}

function parseNumeros(text) {
  const nums = (text || "")
    .trim()
    .split(/\s+/)
    .map(n => parseInt(n, 10))
    .filter(n => !isNaN(n));
  return nums;
}

function getWeekKey(d = new Date()) {
  // Ano-Semana (simples)
  const oneJan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const days = Math.floor((d - oneJan) / 86400000);
  const week = Math.floor((days + oneJan.getUTCDay()) / 7) + 1;
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function postToSheets(payload) {
  const url = process.env.SHEETS_WEBAPP_URL;
  const key = process.env.SHEETS_API_KEY;
  if (!url || !key) throw new Error("SHEETS_WEBAPP_URL ou SHEETS_API_KEY não configurado");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, ...payload }),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok || json.ok === false) {
    throw new Error(json?.error || json?.message || `HTTP ${res.status}: ${text}`);
  }
  return json;
}

async function salvarCadastro(data) {
  return postToSheets({ type: "cadastro", ...data });
}

async function salvarAposta(data) {
  return postToSheets({ type: "aposta", ...data });
}

// START
bot.start(async (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.step = "NOME";
  ctx.session.data = {};
  await ctx.reply("🔥 Bem-vindo ao Clube 5X!\n\nVamos fazer seu cadastro.\n\n✅ Digite seu *Nome e Sobrenome*:", { parse_mode: "Markdown" });
});

bot.on("text", async (ctx) => {
  ctx.session = ctx.session || {};
  const step = ctx.session.step;
  const text = (ctx.message.text || "").trim();

  // Se não tem fluxo, inicia
  if (!step) {
    ctx.session.step = "NOME";
    ctx.session.data = {};
    return ctx.reply("✅ Vamos cadastrar você.\n\nDigite seu *Nome e Sobrenome*:", { parse_mode: "Markdown" });
  }

  // ETAPA 1: NOME
  if (step === "NOME") {
    if (text.length < 5) return ctx.reply("❌ Nome muito curto. Digite *Nome e Sobrenome*:", { parse_mode: "Markdown" });
    ctx.session.data.nome = text;
    ctx.session.step = "TELEFONE";
    return ctx.reply("📞 Agora digite seu *Telefone/WhatsApp* (com DDD):", { parse_mode: "Markdown" });
  }

  // ETAPA 2: TELEFONE
  if (step === "TELEFONE") {
    const fone = onlyDigits(text);
    if (fone.length < 10 || fone.length > 13) return ctx.reply("❌ Telefone inválido. Ex: 83999291290");
    ctx.session.data.telefone = fone;
    ctx.session.step = "CPF";
    return ctx.reply("🪪 Agora digite seu *CPF* (somente números):", { parse_mode: "Markdown" });
  }

  // ETAPA 3: CPF
  if (step === "CPF") {
    const cpf = onlyDigits(text);
    if (cpf.length !== 11) return ctx.reply("❌ CPF inválido. Digite 11 números.");
    ctx.session.data.cpf = cpf;
    ctx.session.step = "EMAIL";
    return ctx.reply("📧 Agora digite seu *Email*:", { parse_mode: "Markdown" });
  }

  // ETAPA 4: EMAIL + SALVAR CADASTRO
  if (step === "EMAIL") {
    if (!isValidEmail(text)) return ctx.reply("❌ Email inválido. Ex: nome@gmail.com");
    ctx.session.data.email = text;

    const userId = String(ctx.from.id);
    const username = ctx.from.username || "";

    try {
      await salvarCadastro({
        telegramId: userId,
        username,
        nome: ctx.session.data.nome,
        telefone: ctx.session.data.telefone,
        cpf: ctx.session.data.cpf,
        email: ctx.session.data.email,
        referredBy: ctx.session.data.referredBy || ""
      });
    } catch (e) {
      // Continua no cadastro salvo em sessão, para tentar novamente
      return ctx.reply("⚠️ Deu erro ao salvar seu cadastro na planilha.\nTente digitar o email novamente em instantes.\n\n(Se continuar, o problema é na SHEETS_WEBAPP_URL / permissões do Apps Script.)");
    }

    ctx.session.step = "APOSTA";
    return ctx.reply(
      "✅ Cadastro concluído!\n\n🎲 Agora digite seus *6 números* entre 01 e 60 separados por espaço.\nEx: 01 03 10 49 50 60",
      { parse_mode: "Markdown" }
    );
  }

  // ETAPA 5: APOSTA
  if (step === "APOSTA") {
    const numeros = parseNumeros(text);

    if (numeros.length !== 6 || numeros.some(n => n < 1 || n > 60)) {
      return ctx.reply("❌ Digite *6 números válidos* entre 01 e 60.\nEx: 01 03 10 49 50 60", { parse_mode: "Markdown" });
    }

    const userId = String(ctx.from.id);
    const weekKey = getWeekKey(new Date());

    try {
      await salvarAposta({
        weekKey,
        telegramId: userId,
        nome: ctx.session.data.nome,
        numeros: numeros.join(" ")
