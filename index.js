const fetch = require("node-fetch");
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== Helpers =====
const STEP = {
  CONSENT: "CONSENT",
  NAME: "NAME",
  PHONE: "PHONE",
  CPF: "CPF",
  EMAIL: "EMAIL",
  BET: "BET",
};

const sessions = new Map(); // telegramId -> { step, data }
const weeklyBetLock = new Map(); // weekKey -> Set(telegramId)

function getSession(id) {
  if (!sessions.has(id)) sessions.set(id, { step: STEP.CONSENT, data: {} });
  return sessions.get(id);
}

function parseStartRef(text) {
  const parts = (text || "").trim().split(" ");
  if (parts.length < 2) return null;
  const p = parts[1];
  if (!p.startsWith("ref_")) return null;
  return p.slice(4);
}

function botRefLink(refCode) {
  const u = process.env.BOT_USERNAME;
  return `https://t.me/${u}?start=ref_${encodeURIComponent(refCode)}`;
}

function normalizePhone(s) {
  return (s || "").replace(/\D/g, "");
}
function isValidPhone(s) {
  const n = normalizePhone(s);
  return n.length === 10 || n.length === 11;
}
function normalizeCpf(s) {
  return (s || "").replace(/\D/g, "");
}
function isValidCpf(s) {
  const cpf = normalizeCpf(s);
  return cpf.length === 11;
}
function isValidEmail(s) {
  const t = (s || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
}
function isValidName(s) {
  const t = (s || "").trim();
  return t.split(" ").length >= 2 && t.length >= 5;
}

// ISO week key: 2026-W07
function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function postToSheets(payload) {
  const URL = process.env.URL_DO_APLICATIVO_WEB_DE_PLANILHAS;
const chave = process.env.CHAVE_API_DO_SHEETS;
  if (!url || !key) throw new Error("SHEETS_WEBAPP_URL ou SHEETS_API_KEY não configurados");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, key }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok !== true) {
    throw new Error(`Sheets error: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

// ===== Bot Flow =====
bot.start(async (ctx) => {
  const userId = String(ctx.from.id);
  const ses = getSession(userId);

  // reset sessão
  ses.step = STEP.CONSENT;
  ses.data = {};

  // ref
  const ref = parseStartRef(ctx.message.text);
  if (ref) ses.data.referredBy = ref;

  const msg =
    `📋 *Cadastro do Clube 6N*\n\n` +
    `Para participar, preciso de: Nome, Telefone, CPF e Email (apenas para cadastro e validação).\n\n` +
    `Você autoriza o uso desses dados para cadastro?\n` +
    `Responda: *SIM* ou *NÃO*`;

  await ctx.reply(msg, { parse_mode: "Markdown" });
});

bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);
  const text = (ctx.message.text || "").trim();
  const ses = getSession(userId);

  // se usuário não iniciou
  if (!ses.step) {
    ses.step = STEP.CONSENT;
    ses.data = {};
  }

  try {
    // 1) Consentimento
    if (ses.step === STEP.CONSENT) {
      if (text.toUpperCase() !== "SIM") {
        return ctx.reply("Sem o aceite eu não consigo concluir o cadastro. Digite /start se quiser tentar novamente.");
      }
      ses.step = STEP.NAME;
      return ctx.reply("Perfeito. Envie seu *Nome e Sobrenome* (ex: Bruno Alencar).", { parse_mode: "Markdown" });
    }

    // 2) Nome
    if (ses.step === STEP.NAME) {
      if (!isValidName(text)) return ctx.reply("Envie *nome e sobrenome* (mínimo 2 palavras). Ex: Bruno Alencar", { parse_mode: "Markdown" });
      ses.data.nome = text;
      ses.step = STEP.PHONE;
      return ctx.reply("Agora seu *Telefone com DDD* (ex: 83900000000).", { parse_mode: "Markdown" });
    }

    // 3) Telefone
    if (ses.step === STEP.PHONE) {
      if (!isValidPhone(text)) return ctx.reply("Telefone inválido. Envie com DDD (10 ou 11 dígitos). Ex: 83999291290");
      ses.data.telefone = normalizePhone(text);
      ses.step = STEP.CPF;
      return ctx.reply("Agora seu *CPF* (11 dígitos).", { parse_mode: "Markdown" });
    }

    // 4) CPF
    if (ses.step === STEP.CPF) {
      if (!isValidCpf(text)) return ctx.reply("CPF inválido. Envie 11 dígitos. Ex: 123.456.789-09");
      ses.data.cpf = normalizeCpf(text);
      ses.step = STEP.EMAIL;
      return ctx.reply("Agora seu *Email* (ex: nome@gmail.com).", { parse_mode: "Markdown" });
    }

    // 5) Email -> salva cadastro
    if (ses.step === STEP.EMAIL) {
      if (!isValidEmail(text)) return ctx.reply("Email inválido. Ex: nome@gmail.com");
      ses.data.email = text.toLowerCase();

      await postToSheets({
        type: "cadastro",
        telegramId: userId,
        username: ctx.from.username ? `@${ctx.from.username}` : "",
        nome: ses.data.nome,
        telefone: ses.data.telefone,
        cpf: ses.data.cpf,
        email: ses.data.email,
        referredBy: ses.data.referredBy || "",
      });

      ses.step = STEP.BET;

      const myLink = botRefLink(userId);
      return ctx.reply(
        `✅ Cadastro concluído!\n\n` +
        `🔗 Seu link de indicação:\n${myLink}\n\n` +
        `Agora envie seus *6 números* entre 01 e 60 (separados por espaço).\n` +
        `Ex: 01 10 22 35 44 59`,
        { parse_mode: "Markdown" }
      );
    }

    // 6) Aposta (6 números) -> salva aposta
    if (ses.step === STEP.BET) {
      const nums = text.split(/\s+/).map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
      const unique = new Set(nums);

      if (nums.length !== 6 || unique.size !== 6 || nums.some((n) => n < 1 || n > 60)) {
        return ctx.reply("❌ Envie exatamente *6 números diferentes* entre 01 e 60.\nEx: 01 10 22 35 44 59", { parse_mode: "Markdown" });
      }

      const weekKey = getWeekKey(new Date());
      if (!weeklyBetLock.has(weekKey)) weeklyBetLock.set(weekKey, new Set());
      const lockSet = weeklyBetLock.get(weekKey);
      if (lockSet.has(userId)) {
        return ctx.reply(`✅ Você já fez sua aposta dessa semana (${weekKey}).`);
      }

      const numerosFmt = Array.from(unique).sort((a,b)=>a-b).map(n => String(n).padStart(2,"0")).join(" ");

      await postToSheets({
        type: "aposta",
        weekKey,
        telegramId: userId,
        nome: ses.data.nome,
        numeros: numerosFmt,
      });

      lockSet.add(userId);

      return ctx.reply(`✅ Aposta registrada (${weekKey}): ${numerosFmt}\n\nBoa sorte! 🍀`);
    }

    return ctx.reply("Digite /start para começar.");
  } catch (err) {
    console.error(err);
    return ctx.reply("⚠️ Deu um erro ao salvar. Tente novamente em instantes.");
  }
});

bot.launch();
console.log("Bot online ✅");
