// Servidor mínimo: serve o jogo, centraliza ranking + leads em data/*.json e
// encaminha cada lead para a plataforma de atendimento via webhook (LEADS_WEBHOOK_URL).
// Sem dependências externas.
const http = require("http"), fs = require("fs"), path = require("path");
const PORT = process.env.PORT || 8080;
const PUB = path.join(__dirname, "..", "public");
const DATA = process.env.DATA_DIR || path.join(__dirname, "..", "data");
// --- NECSO Atende (https://atende.necsobr.com.br/api/v1/docs) ---
const NECSO_BASE = process.env.NECSO_BASE || "https://atende.necsobr.com.br/api/v1";
const NECSO_ID = process.env.NECSO_CLIENT_ID || "";        // Empresa → Canais → canal tipo API
const NECSO_SECRET = process.env.NECSO_CLIENT_SECRET || "";
const NECSO_FUNNEL = process.env.NECSO_FUNNEL_NAME || "Comercial"; // nome do funil no CRM onde o card entra
const NECSO_STAGE = process.env.NECSO_CRM_STAGE_ID || "";          // opcional: etapa específica (padrão: primeira etapa do funil)
const NECSO_TICKET = process.env.NECSO_OPEN_TICKET === "1";        // opcional: também abre ticket e dispara o chatbot
// --- Webhook genérico (alternativa) ---
const WEBHOOK = process.env.LEADS_WEBHOOK_URL || "";
const WEBHOOK_TOKEN = process.env.LEADS_WEBHOOK_TOKEN || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";            // protege /api/leads.csv e /api/reset (?token=)
fs.mkdirSync(DATA, { recursive: true });
const file = n => path.join(DATA, n + ".json");
const load = n => { try { return JSON.parse(fs.readFileSync(file(n), "utf8")); } catch { return []; } };
const save = (n, v) => fs.writeFileSync(file(n), JSON.stringify(v, null, 2));
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", ...CORS }); res.end(JSON.stringify(body)); };
const body = req => new Promise(r => { let s = ""; req.on("data", c => s += c); req.on("end", () => { try { r(JSON.parse(s || "{}")); } catch { r({}); } }); });
const clean = (v, n) => String(v ?? "").slice(0, n);

let tok = { value: "", exp: 0 };
async function necsoToken() {
  if (tok.value && Date.now() < tok.exp) return tok.value;
  const r = await fetch(`${NECSO_BASE}/auth/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: NECSO_ID, clientSecret: NECSO_SECRET }) });
  if (!r.ok) throw new Error(`auth ${r.status}`);
  const j = await r.json(); tok = { value: j.access_token || j.accessToken || j.token, exp: Date.now() + ((j.expires_in || 3600) - 60) * 1000 };
  return tok.value;
}
async function necso(method, path, body, idem) {
  const t = await necsoToken();
  const r = await fetch(`${NECSO_BASE}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, ...(idem ? { "Idempotency-Key": idem } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch {}
  if (!r.ok && r.status !== 409) throw new Error(`${method} ${path} → ${r.status} ${txt.slice(0, 160)}`);
  return j;
}
const digits = p => { let d = String(p).replace(/\D/g, ""); if (d.startsWith("55") && d.length > 11) d = d.slice(2); return d; };
const brl = n => "R$ " + Math.round(+n || 0).toLocaleString("pt-BR");
const pick = (o, ...ks) => { for (const k of ks) if (o && o[k] != null) return o[k]; };
const list = j => Array.isArray(j) ? j : (j && (j.data || j.items || j.funnels || j.stages)) || [];

// Encontra o funil "Comercial" e a etapa de entrada (cacheado)
let funnelCache = null;
async function funnelStage() {
  if (funnelCache) return funnelCache;
  const funnels = list(await necso("GET", "/crm/funnels"));
  const f = funnels.find(x => String(pick(x, "name", "nome", "title")).toLowerCase().includes(NECSO_FUNNEL.toLowerCase())) || funnels[0];
  if (!f) throw new Error(`nenhum funil encontrado no CRM (procurei "${NECSO_FUNNEL}")`);
  const fid = pick(f, "id", "_id");
  let stages = list(f.stages || f.etapas || await necso("GET", `/crm/funnels/${fid}/stages`));
  stages = [...stages].sort((a, b) => (pick(a, "order", "position", "ordem") ?? 0) - (pick(b, "order", "position", "ordem") ?? 0));
  const st = NECSO_STAGE ? stages.find(x => String(pick(x, "id", "_id")) === String(NECSO_STAGE)) : stages[0];
  if (!st) throw new Error(`etapa não encontrada no funil "${pick(f, "name", "nome")}"`);
  funnelCache = { funnelId: fid, funnelName: pick(f, "name", "nome", "title"), stageId: pick(st, "id", "_id"), stageName: pick(st, "name", "nome", "title") };
  console.log(`CRM: funil "${funnelCache.funnelName}" (${fid}) · etapa "${funnelCache.stageName}" (${funnelCache.stageId})`);
  return funnelCache;
}

// Lead → contato + card no funil Comercial (+ ticket opcional)
async function forwardNecso(lead) {
  const phone = digits(lead.phone); const key = `filazero-${phone}-${Date.parse(lead.at)}`;
  const name = lead.name || "Visitante Fila Zero";
  const detalhes = `Origem: Fila Zero · CONSTRUVALE\nEmpresa: ${lead.company || "não informada"}\nWhatsApp: ${phone}\n` +
    `No jogo: ${lead.score} pontos, perdeu ${brl(lead.lost)}` + (lead.estimate ? `\nEstimativa da própria empresa: ${brl(lead.estimate)}/mês sem resposta rápida` : "") +
    `\nPediu: diagnóstico gratuito`;
  const c = await necso("POST", "/contacts", { name, phone, countryCode: "+55", tags: ["Fila Zero", "CONSTRUVALE"],
    attributes: { empresa: lead.company, origem: "Fila Zero · CONSTRUVALE", pontos_fila_zero: lead.score, perdido_no_jogo: lead.lost, estimativa_mensal: lead.estimate } }, key + "-c");
  const contactId = pick(c, "id", "_id", "contactId");
  const { funnelId, stageId } = await funnelStage();
  const card = await necso("POST", `/crm/funnels/${funnelId}/cards`, { stageId, ...(contactId ? { contactId } : { contactName: name, phone }),
    title: `${lead.company || name} · ${brl(lead.estimate || lead.lost)}/mês` }, key + "-k");
  const cardId = pick(card, "id", "_id", "cardId");
  if (cardId) await necso("POST", `/crm/cards/${cardId}/comments`, { body: detalhes }, key + "-m").catch(e => console.log("comentário:", e.message));
  if (NECSO_TICKET) await necso("POST", "/inbound", { externalId: phone, phone, name, text: `Joguei o Fila Zero na CONSTRUVALE e quero o diagnóstico gratuito. ${lead.company ? "Empresa: " + lead.company : ""}`, externalMessageId: key,
    params: { origem: "Fila Zero · CONSTRUVALE", empresa: lead.company } }).catch(e => console.log("ticket:", e.message));
  return `ok card ${cardId || "?"}`;
}
async function forwardWebhook(lead) {
  const r = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json", ...(WEBHOOK_TOKEN ? { Authorization: `Bearer ${WEBHOOK_TOKEN}` } : {}) },
    body: JSON.stringify({ origem: "Fila Zero · CONSTRUVALE", nome: lead.name, empresa: lead.company, whatsapp: lead.phone, pontos: lead.score, perdido_no_jogo: lead.lost, estimativa_mensal: lead.estimate, recebido_em: lead.at }) });
  return r.ok ? "ok" : `http ${r.status}`;
}
async function forward(lead) {
  try {
    if (NECSO_ID && NECSO_SECRET) return await forwardNecso(lead);
    if (WEBHOOK) return await forwardWebhook(lead);
    return "sem integração";
  } catch (e) { return "erro: " + e.message; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  const admin = !ADMIN_TOKEN || url.searchParams.get("token") === ADMIN_TOKEN;

  if (url.pathname === "/api/rank" && req.method === "GET") return json(res, 200, load("rank").slice(0, 10));
  if (url.pathname === "/api/rank" && req.method === "POST") {
    const b = await body(req); const r = load("rank");
    r.push({ name: clean(b.name || "Visitante", 18), score: Math.max(0, +b.score || 0), served: +b.served || 0, at: Date.now() });
    r.sort((a, b) => b.score - a.score); save("rank", r.slice(0, 100)); return json(res, 200, r.slice(0, 10));
  }
  if (url.pathname === "/api/leads" && req.method === "POST") {
    const b = await body(req);
    const lead = { name: clean(b.name, 40), company: clean(b.company, 80), phone: clean(b.phone, 30), score: +b.score || 0, lost: +b.lost || 0, estimate: +b.estimate || 0, at: new Date().toISOString() };
    if (!lead.phone) return json(res, 400, { ok: false, erro: "whatsapp obrigatório" });
    lead.forwarded = await forward(lead);
    const l = load("leads"); l.push(lead); save("leads", l);
    console.log(`lead ${lead.phone} (${lead.company}) → ${lead.forwarded}`);
    return json(res, 200, { ok: true, total: l.length });
  }
  if (url.pathname === "/api/leads.csv") {
    if (!admin) return json(res, 401, { erro: "token" });
    const l = load("leads");
    res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=leads-fila-zero.csv" });
    return res.end("nome;empresa;whatsapp;pontos;perdido;estimativa;enviado;data\n" + l.map(x => [x.name, x.company, x.phone, x.score, x.lost, x.estimate, x.forwarded, x.at].join(";")).join("\n"));
  }
  if (url.pathname === "/api/resend" && req.method === "POST") {   // reenvia leads que não chegaram na plataforma
    if (!admin) return json(res, 401, { erro: "token" });
    const l = load("leads"); let n = 0;
    for (const x of l) if (!String(x.forwarded).startsWith("ok")) { x.forwarded = await forward(x); if (String(x.forwarded).startsWith("ok")) n++; }
    save("leads", l); return json(res, 200, { reenviados: n });
  }
  if (url.pathname === "/api/reset" && req.method === "POST") { if (!admin) return json(res, 401, { erro: "token" }); save("rank", []); return json(res, 200, { ok: true }); }
  if (url.pathname === "/api/crm" && req.method === "GET") {   // confere funil/etapa que será usado
    if (!admin) return json(res, 401, { erro: "token" });
    try { funnelCache = null; return json(res, 200, await funnelStage()); } catch (e) { return json(res, 500, { erro: e.message }); }
  }
  if (url.pathname === "/health") return json(res, 200, { ok: true, necso: !!(NECSO_ID && NECSO_SECRET), webhook: !!WEBHOOK });

  const f = path.join(PUB, url.pathname === "/" ? "index.html" : url.pathname);
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".png") ? "image/png" : "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`Fila Zero em http://localhost:${PORT} · integração: ${NECSO_ID ? "NECSO Atende" : WEBHOOK ? "webhook" : "desligada"}`));
