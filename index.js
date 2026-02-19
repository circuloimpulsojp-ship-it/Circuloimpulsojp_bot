// ✅ CONFIG
const SHEET_CADASTROS = "cadastros";
const SHEET_APOSTAS = "apostas";

// Cria as abas e cabeçalhos se não existirem
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const cad = ss.getSheetByName(SHEET_CADASTROS) || ss.insertSheet(SHEET_CADASTROS);
  const apo = ss.getSheetByName(SHEET_APOSTAS) || ss.insertSheet(SHEET_APOSTAS);

  if (cad.getLastRow() === 0) {
    cad.appendRow([
      "createdAt", "telegramId", "username", "nome", "telefone", "cpf", "email", "referredBy"
    ]);
  }

  if (apo.getLastRow() === 0) {
    apo.appendRow([
      "createdAt", "weekKey", "telegramId", "nome", "numeros"
    ]);
  }

  return "OK";
}

function doGet() {
  // Só pra você testar no navegador e ver se está online
  return json_({ ok: true, message: "WebApp online. Use POST JSON para gravar." });
}

function doPost(e) {
  try {
    const data = parseJson_(e);

    // ✅ Segurança: exige key
    const key = String(data.key || "");
    const expected = String(PropertiesService.getScriptProperties().getProperty("SHEETS_API_KEY") || "");
    if (!expected) {
      return json_({ ok: false, error: "SHEETS_API_KEY não configurado no Script Properties" }, 500);
    }
    if (key !== expected) {
      return json_({ ok: false, error: "Chave inválida" }, 401);
    }

    const type = String(data.type || "");
    if (!type) return json_({ ok: false, error: "type obrigatório" }, 400);

    // Garante abas/cabeçalhos
    setup();

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (type === "cadastro") {
      const sh = ss.getSheetByName(SHEET_CADASTROS);

      sh.appendRow([
        data.createdAt || new Date().toISOString(),
        data.telegramId || "",
        data.username || "",
        data.nome || "",
        data.telefone || "",
        data.cpf || "",
        data.email || "",
        data.referredBy || ""
      ]);

      return json_({ ok: true, saved: "cadastro" });
    }

    if (type === "aposta") {
      const sh = ss.getSheetByName(SHEET_APOSTAS);

      sh.appendRow([
        data.createdAt || new Date().toISOString(),
        data.weekKey || "",
        data.telegramId || "",
        data.nome || "",
        data.numeros || ""
      ]);

      return json_({ ok: true, saved: "aposta" });
    }

    return json_({ ok: false, error: "type inválido (use cadastro ou aposta)" }, 400);

  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}


// ===== helpers =====
function parseJson_(e) {
  // Aceita JSON no body
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  // fallback (não recomendado)
  return {};
}

function json_(obj, status) {
  const out = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

  // Apps Script não deixa setar status HTTP direto sempre.
  // Mas o JSON "ok:false" já resolve pro bot.
  return out;
}
