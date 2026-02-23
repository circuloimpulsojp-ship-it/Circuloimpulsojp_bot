const { Telegraf, session } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

function onlyDigits(text) {
  return text.replace(/\D/g, "");
}

function validarNumeros(text) {
  const nums = text.trim().split(/\s+/).map(n => parseInt(n));
  if (nums.length !== 6) return false;
  if (nums.some(n => isNaN(n) || n < 1 || n > 60)) return false;
  if (new Set(nums).size !== 6) return false;
  return nums;
}

bot.start((ctx) => {
  ctx.session.step = "nome";
  ctx.session.data = {};
  ctx.reply("👋 Bem-vindo!\n\nDigite seu Nome completo:");
});

bot.on("text", async (ctx) => {
  const step = ctx.session.step;
  const text = ctx.message.text;

  if (!step) {
    ctx.session.step = "nome";
    ctx.session.data = {};
    return ctx.reply("Digite seu Nome completo:");
  }

  // 1️⃣ Nome
  if (step === "nome") {
    ctx.session.data.nome = text;
    ctx.session.step = "cpf";
    return ctx.reply("Digite seu CPF (somente números):");
  }

  // 2️⃣ CPF
  if (step === "cpf") {
    const cpf = onlyDigits(text);
    if (cpf.length !== 11) {
      return ctx.reply("❌ CPF inválido. Digite 11 números.");
    }
    ctx.session.data.cpf = cpf;
    ctx.session.step = "telefone";
    return ctx.reply("Digite seu Telefone (com DDD):");
  }

  // 3️⃣ Telefone
  if (step === "telefone") {
    const telefone = onlyDigits(text);
    if (telefone.length < 10) {
      return ctx.reply("❌ Telefone inválido.");
    }
    ctx.session.data.telefone = telefone;
    ctx.session.step = "numeros";
    return ctx.reply("Agora escolha 6 números de 01 a 60 separados por espaço.\nEx: 01 10 22 35 44 59");
  }

  // 4️⃣ Números
  if (step === "numeros") {
    const numeros = validarNumeros(text);
    if (!numeros) {
      return ctx.reply("❌ Envie 6 números válidos entre 01 e 60.");
    }

    ctx.reply(
      `✅ Cadastro concluído!\n\n` +
      `Nome: ${ctx.session.data.nome}\n` +
      `CPF: ${ctx.session.data.cpf}\n` +
      `Telefone: ${ctx.session.data.telefone}\n\n` +
      `Números escolhidos: ${numeros.join(", ")}`
    );

    ctx.session.step = null;
    ctx.session.data = {};
  }
});

bot.launch();
console.log("Bot rodando...");
