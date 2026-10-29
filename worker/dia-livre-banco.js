// Servidor da conexão com o banco do Dia Livre (Cloudflare Worker).
// Guarda a chave da Pluggy em segredo e só atende quem entrou no app com o e-mail autorizado.
//
// Variáveis do Worker (Settings > Variables and Secrets):
//   PLUGGY_CLIENT_ID      (Secret)  Client ID da aplicação no dashboard.pluggy.ai
//   PLUGGY_CLIENT_SECRET  (Secret)  Client Secret da mesma aplicação
//   ALLOWED_EMAIL         (Text)    e-mail(s) do Google usados no Dia Livre, separados por vírgula
//   FIREBASE_PROJECT_ID   (Text)    dia-livre
//   ALLOWED_ORIGIN        (Text)    https://jmarcicofast-cell.github.io
//   GEMINI_API_KEY        (Secret)  chave gratuita do Google AI Studio (aistudio.google.com/apikey), para a IA do app
//
// Rotas (todas POST, com "Authorization: Bearer <token do login do Firebase>"):
//   /connect-token  { itemId? }                     -> { accessToken }   abre a janela do Meu Pluggy
//   /sync           { itemIds, from, refresh? }     -> { items, accounts, transactions }
//   /ia             { contents, model? }            -> { text }   IA do app (Gemini), sem depender do Firebase AI Logic

const API = "https://api.pluggy.ai";
const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export default {
  async fetch(req, env) {
    const origem = env.ALLOWED_ORIGIN || "https://jmarcicofast-cell.github.io";
    const cors = {
      "Access-Control-Allow-Origin": origem,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") return resp({ ok: true, servico: "Dia Livre banco" });
    if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);

    try {
      if (url.pathname === "/ia") {
        for (const k of ["GEMINI_API_KEY", "ALLOWED_EMAIL", "FIREBASE_PROJECT_ID"])
          if (!env[k]) return resp({ erro: "Falta configurar " + k + " no Worker." }, 500);
        if (!await verificarLogin(req.headers.get("Authorization") || "", env))
          return resp({ erro: "Login não autorizado. Entre no app com o e-mail cadastrado no servidor." }, 401);
        const corpo = await req.json().catch(() => ({}));
        const contents = (Array.isArray(corpo.contents) ? corpo.contents : []).slice(-40);
        if (!contents.length) return resp({ erro: "Mensagem vazia." }, 400);
        const modelo = /^gemini-[\w.-]+$/.test(corpo.model || "") ? corpo.model : "gemini-3.8-flash";
        // Se o modelo estiver sobrecarregado (503/429/500), tenta de novo e depois passa para modelos reserva.
        const fila = [...new Set([modelo, modelo, "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"])];
        let ultimo = null;
        for (let i = 0; i < fila.length; i++) {
          if (i > 0) await new Promise(ok => setTimeout(ok, 800 * i));
          const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + fila[i] + ":generateContent",
            { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: JSON.stringify({ contents }) });
          const j = await r.json().catch(() => ({}));
          if (r.ok) {
            const text = ((j.candidates || [])[0]?.content?.parts || []).map(p => p.text || "").join("");
            return resp({ text, model: fila[i] });
          }
          ultimo = { status: r.status, msg: (j.error && j.error.message) || "erro" };
          // Só vale tentar outro modelo se for sobrecarga ou modelo inexistente; erro de chave, por exemplo, não melhora.
          if (![429, 500, 503, 404].includes(r.status)) break;
        }
        const ocupado = ultimo && [429, 500, 503].includes(ultimo.status);
        return resp({ erro: ocupado ? "A IA do Google está sobrecarregada agora. Tente de novo em alguns minutos."
          : "Gemini " + ultimo.status + ": " + ultimo.msg }, ultimo && ultimo.status === 429 ? 429 : 502);
      }

      for (const k of ["PLUGGY_CLIENT_ID", "PLUGGY_CLIENT_SECRET", "ALLOWED_EMAIL", "FIREBASE_PROJECT_ID"])
        if (!env[k]) return resp({ erro: "Falta configurar " + k + " no Worker." }, 500);

      const quem = await verificarLogin(req.headers.get("Authorization") || "", env);
      if (!quem) return resp({ erro: "Login não autorizado. Entre no app com o e-mail cadastrado no servidor." }, 401);

      const corpo = await req.json().catch(() => ({}));
      const pluggy = await clientePluggy(env);

      if (url.pathname === "/connect-token") {
        const body = {};
        if (corpo.itemId && /^[0-9a-f-]{20,}$/i.test(corpo.itemId)) body.itemId = corpo.itemId;
        const r = await pluggy("POST", "/connect_token", body);
        return resp({ accessToken: r.accessToken });
      }

      if (url.pathname === "/sync") {
        const ids = (Array.isArray(corpo.itemIds) ? corpo.itemIds : []).filter(i => /^[0-9a-f-]{20,}$/i.test(i)).slice(0, 5);
        const desde = /^\d{4}-\d{2}-\d{2}$/.test(corpo.from || "") ? corpo.from : new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
        const items = [], accounts = [], transactions = [];
        for (const id of ids) {
          if (corpo.refresh) { try { await pluggy("PATCH", "/items/" + id, {}); } catch (e) { /* segue com os dados que já existem */ } }
          let it;
          try { it = await pluggy("GET", "/items/" + id); }
          catch (e) { items.push({ id, status: "ERRO", detalhe: e.message }); continue; }
          items.push({ id, status: it.status, nome: it.connector && it.connector.name, atualizado: it.lastUpdatedAt || it.updatedAt, detalhe: it.executionStatus || "" });
          const contas = await listarContas(pluggy, id);
          for (const a of contas) {
            const cd = a.creditData || {};
            accounts.push({ id: a.id, itemId: id, type: a.type, name: a.marketingName || a.name, number: a.number,
              balance: a.balance, creditLimit: cd.creditLimit, availableCreditLimit: cd.availableCreditLimit,
              closeDate: cd.balanceCloseDate, dueDate: cd.balanceDueDate });
            const txs = await listarTransacoes(pluggy, a.id, desde);
            for (const t of txs) {
              const cc = t.creditCardMetadata || {};
              transactions.push({ id: t.id, accountId: a.id, date: t.date, description: t.description || t.descriptionRaw || "",
                amount: t.amount, type: t.type, category: t.category || "", status: t.status,
                inst: cc.installmentNumber || 0, totalInst: cc.totalInstallments || 0, purchaseDate: cc.purchaseDate || "", totalAmount: cc.totalAmount || 0 });
            }
          }
        }
        return resp({ items, accounts, transactions });
      }

      return resp({ erro: "Rota não encontrada." }, 404);
    } catch (e) {
      return resp({ erro: String(e && e.message || e).slice(0, 300) }, 502);
    }
  }
};

/* ---------- Pluggy ---------- */
let chaveCache = { k: "", ate: 0 };
async function clientePluggy(env) {
  if (!chaveCache.k || Date.now() > chaveCache.ate) {
    const r = await fetch(API + "/auth", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.apiKey) throw new Error("A Pluggy recusou o Client ID/Secret (" + r.status + ").");
    chaveCache = { k: j.apiKey, ate: Date.now() + 100 * 60e3 }; // a chave vale 2 horas
  }
  return async (metodo, caminho, corpo) => {
    const u = caminho.startsWith("http") ? caminho : API + caminho;
    if (!u.startsWith(API + "/")) throw new Error("Endereço inesperado da Pluggy.");
    const r = await fetch(u, { method: metodo, headers: { "Content-Type": "application/json", "X-API-KEY": chaveCache.k },
      body: corpo && metodo !== "GET" ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error("Pluggy " + r.status + ": " + (j.message || j.error || "erro")); e.status = r.status; throw e; }
    return j;
  };
}
async function listarContas(pluggy, itemId) {
  const r = await pluggy("GET", "/accounts?itemId=" + encodeURIComponent(itemId));
  return r.results || [];
}
async function listarTransacoes(pluggy, accountId, desde) {
  // GET /v2/transactions com paginação por cursor. A Pluggy devolve "next" já pronto
  // (ex.: "?accountId=...&after=CURSOR"), que deve ser colado no fim do endereço como veio.
  // O endpoint antigo /transactions foi desligado (responde 410), então não há mais volta para ele.
  const out = [];
  const base = "/v2/transactions";
  let caminho = base + "?accountId=" + encodeURIComponent(accountId) + "&dateFrom=" + desde;
  const vistos = new Set();
  for (let i = 0; i < 50 && caminho && !vistos.has(caminho); i++) {
    vistos.add(caminho);
    const r = await pluggy("GET", caminho);
    out.push(...(r.results || []));
    const nx = r.next;
    if (!nx) caminho = "";
    else if (/^https?:/.test(nx)) caminho = nx;
    else if (nx.startsWith("/")) caminho = nx;
    else if (nx.startsWith("?")) caminho = base + nx;
    else caminho = base + "?accountId=" + encodeURIComponent(accountId) + "&dateFrom=" + desde + "&after=" + encodeURIComponent(nx);
  }
  return out;
}

/* ---------- Login do Firebase (verifica a assinatura do token do Google) ---------- */
let jwkCache = { keys: null, ate: 0 };
function b64url(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function verificarLogin(header, env) {
  const m = header.match(/^Bearer\s+(.+)$/); if (!m) return null;
  const [h, p, sig] = m[1].split("."); if (!h || !p || !sig) return null;
  const head = JSON.parse(new TextDecoder().decode(b64url(h)));
  const pay = JSON.parse(new TextDecoder().decode(b64url(p)));
  if (head.alg !== "RS256") return null;
  if (!jwkCache.keys || Date.now() > jwkCache.ate) {
    const r = await fetch(JWK_URL); jwkCache = { keys: (await r.json()).keys || [], ate: Date.now() + 3600e3 };
  }
  const jwk = jwkCache.keys.find(k => k.kid === head.kid); if (!jwk) return null;
  const chave = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", chave, b64url(sig), new TextEncoder().encode(h + "." + p));
  if (!ok) return null;
  const agora = Math.floor(Date.now() / 1000);
  if (pay.aud !== env.FIREBASE_PROJECT_ID || pay.iss !== "https://securetoken.google.com/" + env.FIREBASE_PROJECT_ID) return null;
  if (!(pay.exp > agora) || !(pay.iat <= agora + 60)) return null;
  const permitidos = String(env.ALLOWED_EMAIL).toLowerCase().split(/[,;\s]+/).filter(Boolean);
  if (!pay.email_verified || !permitidos.includes(String(pay.email).toLowerCase())) return null;
  return pay.email;
}
