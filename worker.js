const ALLOWED_ORIGIN = "https://aj1716-qa.github.io";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const ITERATIONS = 100000;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function response(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function b64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function fromB64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function derive(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256));
}
async function sha(text) {
  return b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64(bytes).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
let schemaReady = null;
async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`,
        `CREATE TABLE IF NOT EXISTS user_data (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          data_json TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      ];
      for (const sql of statements) await env.DB.prepare(sql).run();
    })().catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}
async function auth(req, env) {
  const raw = req.headers.get("Authorization") || "";
  if (!raw.startsWith("Bearer ")) return null;
  const hash = await sha(raw.slice(7));
  const row = await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?").bind(hash, Math.floor(Date.now()/1000)).first();
  return row?.user_id || null;
}
export default {
 async fetch(req, env) {
  const origin = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") return new Response(null, {status:204, headers:cors(origin)});
  if (origin !== ALLOWED_ORIGIN) return response({error:"Origin not allowed"},403,origin);
  const url = new URL(req.url);
  try {
   await ensureSchema(env);
   if (url.pathname === "/api/health" && req.method === "GET") return response({ok:true,service:"Pautang Manager API"},200,origin);
   if (url.pathname === "/api/register" && req.method === "POST") {
    const body = await req.json();
    const email = String(body.email||"").trim().toLowerCase();
    const password = String(body.password||"");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return response({error:"Enter a valid email address."},400,origin);
    if (password.length<10 || password.length>128) return response({error:"Password must be 10–128 characters."},400,origin);
    const id = crypto.randomUUID(), salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password,salt);
    try { await env.DB.prepare("INSERT INTO users(id,email,password_salt,password_hash) VALUES(?,?,?,?)").bind(id,email,b64(salt),hash).run(); }
    catch(e) { return response({error:"An account with this email may already exist."},409,origin); }
    return await createSession(id,env,origin);
   }
   if (url.pathname === "/api/login" && req.method === "POST") {
    const body=await req.json(), email=String(body.email||"").trim().toLowerCase(), password=String(body.password||"");
    const user=await env.DB.prepare("SELECT id,password_salt,password_hash FROM users WHERE email=?").bind(email).first();
    if (!user) return response({error:"Email or password is incorrect."},401,origin);
    const actual=await derive(password,fromB64(user.password_salt));
    if (actual!==user.password_hash) return response({error:"Email or password is incorrect."},401,origin);
    return await createSession(user.id,env,origin);
   }
   if (url.pathname === "/api/data" && (req.method==="GET" || req.method==="PUT")) {
    const userId=await auth(req,env);
    if (!userId) return response({error:"Please sign in again."},401,origin);
    if (req.method==="GET") {
      const row=await env.DB.prepare("SELECT data_json FROM user_data WHERE user_id=?").bind(userId).first();
      return response({data:row?JSON.parse(row.data_json):null},200,origin);
    }
    const body=await req.json();
    if (!body.data || !Array.isArray(body.data.borrowers) || !Array.isArray(body.data.loans) || !Array.isArray(body.data.payments)) return response({error:"Invalid lending records."},400,origin);
    const json=JSON.stringify(body.data);
    if (json.length>900000) return response({error:"Your backup is too large to sync (maximum about 900 KB). Export a backup and contact support."},413,origin);
    await env.DB.prepare("INSERT INTO user_data(user_id,data_json,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET data_json=excluded.data_json,updated_at=CURRENT_TIMESTAMP").bind(userId,json).run();
    return response({ok:true},200,origin);
   }
   if (url.pathname === "/api/logout" && req.method==="POST") {
    const raw=(req.headers.get("Authorization")||"").replace(/^Bearer /,"");
    if(raw) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha(raw)).run();
    return response({ok:true},200,origin);
   }
   return response({error:"Not found"},404,origin);
  } catch(e) { return response({error:"Server error. Please try again."},500,origin); }
 }
};
async function createSession(userId,env,origin) {
 const value=token(), hash=await sha(value), expires=Math.floor(Date.now()/1000)+SESSION_SECONDS;
 await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(hash,userId,expires).run();
 return response({token:value,expiresAt:expires},200,origin);
}