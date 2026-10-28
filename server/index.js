// Servidor mínimo: serve o jogo e guarda ranking + leads em data/*.json.
// Sem dependências externas.
const http = require("http"), fs = require("fs"), path = require("path");
const PORT = process.env.PORT || 8080;
const PUB = path.join(__dirname, "..", "public");
const DATA = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(DATA, { recursive: true });
const file = n => path.join(DATA, n + ".json");
const load = n => { try { return JSON.parse(fs.readFileSync(file(n), "utf8")); } catch { return []; } };
const save = (n, v) => fs.writeFileSync(file(n), JSON.stringify(v, null, 2));
const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
const body = req => new Promise(r => { let s = ""; req.on("data", c => s += c); req.on("end", () => { try { r(JSON.parse(s || "{}")); } catch { r({}); } }); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/rank" && req.method === "GET") return json(res, 200, load("rank").slice(0, 10));
  if (url.pathname === "/api/rank" && req.method === "POST") {
    const b = await body(req); const r = load("rank");
    r.push({ name: String(b.name || "Visitante").slice(0, 18), score: +b.score || 0, served: +b.served || 0, at: Date.now() });
    r.sort((a, b) => b.score - a.score); save("rank", r.slice(0, 100)); return json(res, 200, r.slice(0, 10));
  }
  if (url.pathname === "/api/leads" && req.method === "POST") {
    const b = await body(req); const l = load("leads");
    l.push({ name: b.name, company: b.company, phone: b.phone, score: b.score, lost: b.lost, at: new Date().toISOString() });
    save("leads", l); return json(res, 200, { ok: true, total: l.length });
  }
  if (url.pathname === "/api/leads.csv") {
    const l = load("leads");
    res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=leads-fila-zero.csv" });
    return res.end("nome;empresa;whatsapp;pontos;perdido;data\n" + l.map(x => [x.name, x.company, x.phone, x.score, x.lost, x.at].join(";")).join("\n"));
  }
  if (url.pathname === "/api/reset" && req.method === "POST") { save("rank", []); return json(res, 200, { ok: true }); }
  const f = path.join(PUB, url.pathname === "/" ? "index.html" : url.pathname);
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`Fila Zero em http://localhost:${PORT}`));
