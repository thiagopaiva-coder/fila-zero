// Servidor mínimo: serve o jogo, centraliza ranking + leads em data/*.json e
// encaminha cada lead para a plataforma de atendimento via webhook (LEADS_WEBHOOK_URL).
// Sem dependências externas.
const http = require("http"), fs = require("fs"), path = require("path");
const PORT = process.env.PORT || 8080;
const PUB = path.join(__dirname, "..", "public");
const DATA = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const WEBHOOK = process.env.LEADS_WEBHOOK_URL || "";          // ex.: https://atende.necsobr.com.br/api/leads
const WEBHOOK_TOKEN = process.env.LEADS_WEBHOOK_TOKEN || "";  // enviado como Authorization: Bearer <token>
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";            // protege /api/leads.csv e /api/reset (?token=)
fs.mkdirSync(DATA, { recursive: true });
const file = n => path.join(DATA, n + ".json");
const load = n => { try { return JSON.parse(fs.readFileSync(file(n), "utf8")); } catch { return []; } };
const save = (n, v) => fs.writeFileSync(file(n), JSON.stringify(v, null, 2));
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", ...CORS }); res.end(JSON.stringify(body)); };
const body = req => new Promise(r => { let s = ""; req.on("data", c => s += c); req.on("end", () => { try { r(JSON.parse(s || "{}")); } catch { r({}); } }); });
const clean = (v, n) => String(v ?? "").slice(0, n);

async function forward(lead) {
  if (!WEBHOOK) return "sem webhook";
  try {
    const r = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json", ...(WEBHOOK_TOKEN ? { Authorization: `Bearer ${WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({ origem: "Fila Zero · CONSTRUVALE", nome: lead.name, empresa: lead.company, whatsapp: lead.phone,
        pontos: lead.score, perdido_no_jogo: lead.lost, estimativa_mensal: lead.estimate, recebido_em: lead.at }) });
    return r.ok ? "ok" : `http ${r.status}`;
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
    for (const x of l) if (x.forwarded !== "ok") { x.forwarded = await forward(x); if (x.forwarded === "ok") n++; }
    save("leads", l); return json(res, 200, { reenviados: n });
  }
  if (url.pathname === "/api/reset" && req.method === "POST") { if (!admin) return json(res, 401, { erro: "token" }); save("rank", []); return json(res, 200, { ok: true }); }
  if (url.pathname === "/health") return json(res, 200, { ok: true, webhook: !!WEBHOOK });

  const f = path.join(PUB, url.pathname === "/" ? "index.html" : url.pathname);
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".png") ? "image/png" : "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`Fila Zero em http://localhost:${PORT} · webhook: ${WEBHOOK || "desligado"}`));
