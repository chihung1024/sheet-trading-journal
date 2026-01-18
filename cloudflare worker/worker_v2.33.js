/**
 * Worker: 交易管理與即時報價 API (多人隔離升級版)
 */

const GOOGLE_CLIENT_ID = "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-KEY",
};

export default {
  async fetch(request, env, ctx) {
    // 1. 處理 CORS 預檢請求 (Preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
        // --- 路由區域 ---

        // [POST] Google 登入驗證
        if (url.pathname === "/auth/google" && request.method === "POST") {
            return addCors(await handleAuth(request));
        }

        // [POST] 觸發 GitHub Action (更新股價)
        if (url.pathname === "/api/trigger-update" && request.method === "POST") {
            const user = await authenticate(request, env);
            // 允許登入的使用者或管理員觸發
            if (!user) return addCors(jsonResponse({ error: "Unauthorized" }, 401));
            return addCors(await handleGitHubTrigger(request, env));
        }

        // [GET/POST] 投資組合報價 (Portfolio)
        if (url.pathname === "/api/portfolio") {
          const user = await authenticate(request, env);
          
          // 若是 Python 腳本 (Admin) 或 使用者，允許 POST 上傳
          if (request.method === "POST") {
              if (user) {
                  return addCors(await handleUploadPortfolio(request, env, user));
              }
              return addCors(jsonResponse({ error: "Unauthorized" }, 401));
          }

          // 若是前端 (User)，允許 GET 讀取
          if (request.method === "GET") {
              // 為了方便，若沒登入給空資料，有登入則呼叫處理函式
              if (!user) {
                  return addCors(jsonResponse({ success: true, data: { summary: {}, holdings: [], history: [] } }));
              }
              // [修改] 傳入 user 以便進行資料過濾
              return addCors(await handleGetPortfolio(env, user));
          }
        }

        // [CRUD] 交易紀錄 (Records)
        if (url.pathname === "/api/records") {
            const user = await authenticate(request, env);
            if (!user) return addCors(jsonResponse({ error: "Unauthorized" }, 401));

            if (request.method === "GET") return addCors(await handleGetRecords(request, env, user));
            else if (request.method === "POST") return addCors(await handleAddRecord(request, env, user));
            else if (request.method === "PUT") return addCors(await handleUpdateRecord(request, env, user));
            else if (request.method === "DELETE") return addCors(await handleDeleteRecord(request, env, user));
            
            return addCors(new Response("Method Not Allowed", { status: 405 }));
        }

        // 404 Not Found
        return addCors(jsonResponse({ error: "Route Not Found" }, 404));
    } catch (err) {
        return addCors(jsonResponse({ error: "Server Error: " + err.message }, 500));
    }
  }
};

// ==========================================
// 業務邏輯與資料庫操作
// ==========================================

// 登入處理
async function handleAuth(request) {
  try {
    const { id_token } = await request.json();
    const payload = await verifyGoogleToken(id_token, GOOGLE_CLIENT_ID);
    return jsonResponse({ 
        success: true, 
        user: payload.name, 
        email: payload.email, 
        token: id_token 
    });
  } catch (err) {
    return jsonResponse({ success: false, error: "驗證失敗: " + err.message }, 401);
  }
}

// 身份驗證 (支援 API Key 與 Google Token)
async function authenticate(request, env) {
  const apiKey = request.headers.get("X-API-KEY");
  if (apiKey && env.API_SECRET && apiKey === env.API_SECRET) {
    return { email: 'system', role: 'admin' };
  }
  
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  try {
    const token = authHeader.split(" ")[1];
    // 驗證 Token
    const payload = await verifyGoogleToken(token, GOOGLE_CLIENT_ID);
    
    // [建議]：印出日誌確認目前的登入帳號，這可以在 Cloudflare 控制台看到
    console.log(`成功驗證帳號: ${payload.email}`);
    
    return { email: payload.email, name: payload.name, role: 'user' };
  } catch (e) {
    // [建議]：若驗證失敗，印出原因 (例如: Expired Token)
    console.error(`身份驗證失敗: ${e.message}`);
    return null; 
  }
}

// [修改] 取得最新報價：加入 user 參數並執行過濾
async function handleGetPortfolio(env, user) {
  try {
    // 關鍵修改：增加 WHERE user_id = ? 確保不同帳號看不到彼此的數字
    const result = await env.DB.prepare(
      "SELECT json_data FROM portfolio_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT 1"
    ).bind(user.email).first();

    if (!result) {
      return jsonResponse({ success: true, data: { summary: {}, holdings: [], history: [] } });
    }
    const parsedData = JSON.parse(result.json_data);
    return jsonResponse({ success: true, data: parsedData });
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 500);
  }
}

// [修改] 上傳報價：支援代理上傳
async function handleUploadPortfolio(request, env, user) {
  try {
    const payload = await request.json();
    
    // 預設擁有者是當前連線者 (例如 system)
    let ownerId = user.email;
    let dataToSave = payload;

    // 如果是 Admin 且有指定目標，則切換擁有者身分 (代理機制)
    if (user.role === 'admin' && payload.target_user_id) {
        ownerId = payload.target_user_id;
        dataToSave = payload.data || payload; 
    }

    const jsonString = JSON.stringify(dataToSave);
    
    // 寫入資料庫
    await env.DB.prepare(
      "INSERT INTO portfolio_snapshots (user_id, json_data) VALUES (?, ?)"
    ).bind(ownerId, jsonString).run();

    // 清理舊資料：僅針對該使用者保留最新 10 筆，避免刪除到其他使用者的資料
    await env.DB.prepare(
      "DELETE FROM portfolio_snapshots WHERE user_id = ? AND id NOT IN (SELECT id FROM portfolio_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT 10)"
    ).bind(ownerId, ownerId).run();

    return jsonResponse({ success: true, message: `Upload success for ${ownerId}` });
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 500);
  }
}

// --- 交易紀錄 CRUD ---

async function handleGetRecords(req, env, user) {
    let stmt;
    if (user.role === 'admin') {
        stmt = env.DB.prepare("SELECT * FROM records ORDER BY txn_date DESC, created_at DESC LIMIT 1000");
    } else {
        stmt = env.DB.prepare("SELECT * FROM records WHERE user_id = ? ORDER BY txn_date DESC, created_at DESC LIMIT 1000").bind(user.email);
    }
    const { results } = await stmt.all();
    return jsonResponse({ success: true, data: results });
}

async function handleAddRecord(req, env, user) {
  const b = await req.json();
  await env.DB.prepare(
    "INSERT INTO records (user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
      user.email, 
      b.txn_date, 
      b.symbol.toUpperCase(), 
      b.txn_type, 
      b.qty, 
      b.price, 
      b.fee || 0, 
      b.tax || 0,
      b.tag || 'Stock', 
      b.note || ''
  ).run();
  return jsonResponse({ success: true });
}

async function handleUpdateRecord(req, env, user) {
  const b = await req.json();
  await env.DB.prepare(
    "UPDATE records SET txn_date=?, symbol=?, txn_type=?, qty=?, price=?, fee=?, tax=?, tag=?, note=? WHERE id=? AND user_id=?"
  ).bind(
      b.txn_date, 
      b.symbol.toUpperCase(), 
      b.txn_type, 
      b.qty, 
      b.price, 
      b.fee || 0, 
      b.tax || 0,
      b.tag || 'Stock', 
      b.note || '', 
      b.id, 
      user.email
  ).run();
  return jsonResponse({ success: true });
}

async function handleDeleteRecord(req, env, user) {
  const { id } = await req.json();
  await env.DB.prepare("DELETE FROM records WHERE id = ? AND user_id = ?").bind(id, user.email).run();
  return jsonResponse({ success: true });
}

// 觸發 GitHub Action
async function handleGitHubTrigger(req, env) {
  if (!env.GITHUB_TOKEN) return jsonResponse({ error: "No Token Configured" }, 500);
  const ghUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/update.yml/dispatches`;
  
  const resp = await fetch(ghUrl, { 
      method: 'POST', 
      headers: { 
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
          'Accept': 'application/vnd.github.v3+json', 
          'User-Agent': 'Cloudflare Worker' 
      }, 
      body: JSON.stringify({ ref: 'main' }) 
  });
  return jsonResponse({ success: resp.ok });
}

// ==========================================
// 輔助函式 (Helpers)
// ==========================================

function addCors(response) {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers: newHeaders });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// ==========================================
// Google JWT 驗證邏輯 (Native Web Crypto)
// ==========================================
async function verifyGoogleToken(token, aud) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Token Format");

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  if (payload.aud !== aud) throw new Error("Invalid Audience");
  if (payload.exp < Math.floor(Date.now()/1000)) throw new Error("Expired Token");

  const keysResp = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const keys = await keysResp.json();
  const key = keys.keys.find(k => k.kid === header.kid);
  if (!key) throw new Error("Key not found");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk", key, 
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, 
    false, ["verify"]
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", 
    cryptoKey, 
    base64UrlDecode(parts[2]), 
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!valid) throw new Error("Invalid Signature");
  return payload;
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
