/**
 * Worker: 交易管理與即時報價 API (多人隔離修正版)
 * 修復：解決交易紀錄刪除後數據殘留的問題
 * v2.35: 新增支援自訂基準標的 (custom_benchmark)
 */

const GOOGLE_CLIENT_ID = "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-KEY",
};

export default {
  async fetch(request, env, ctx) {
    // 1. 處理 CORS 預檢請求
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

        // [POST] 觸發 GitHub Action (✅ 支援 benchmark 參數)
        if (url.pathname === "/api/trigger-update" && request.method === "POST") {
            const user = await authenticate(request, env);
            if (!user) return addCors(jsonResponse({ error: "Unauthorized" }, 401));
            return addCors(await handleGitHubTrigger(request, env, user));
        }

        // [GET/POST] 投資組合報價 (Portfolio)
        if (url.pathname === "/api/portfolio") {
          const user = await authenticate(request, env);
          
          if (request.method === "POST") {
              if (user) {
                  return addCors(await handleUploadPortfolio(request, env, user));
              }
              return addCors(jsonResponse({ error: "Unauthorized" }, 401));
          }

          if (request.method === "GET") {
              if (!user) {
                  return addCors(jsonResponse({ success: true, data: { summary: {}, holdings: [], history: [] } }));
              }
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

        return addCors(jsonResponse({ error: "Route Not Found" }, 404));
    } catch (err) {
        return addCors(jsonResponse({ error: "Server Error: " + err.message }, 500));
    }
  }
};

// ==========================================
// 業務邏輯與資料庫操作
// ==========================================

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

async function authenticate(request, env) {
  const apiKey = request.headers.get("X-API-KEY");
  if (apiKey && env.API_SECRET && apiKey === env.API_SECRET) {
    return { email: 'system', role: 'admin' };
  }
  
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  try {
    const token = authHeader.split(" ")[1];
    const payload = await verifyGoogleToken(token, GOOGLE_CLIENT_ID);
    return { email: payload.email, name: payload.name, role: 'user' };
  } catch (e) {
    return null; 
  }
}

/**
 * 獲取投資組合快照
 * 修正：增加紀錄筆數檢查，若無紀錄則回傳空值，防止死而復生 bug
 */
async function handleGetPortfolio(env, user) {
  try {
    // 1. 優先檢查交易紀錄是否存在 (唯一真理來源)
    const recordCheck = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM records WHERE user_id = ?"
    ).bind(user.email).first();

    // 2. 如果紀錄為 0，直接回傳空模板，無視可能殘留的舊快照
    if (!recordCheck || recordCheck.total === 0) {
      return jsonResponse({ success: true, data: { summary: {}, holdings: [], history: [] } });
    }

    // 3. 有紀錄才讀取最新快照
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

async function handleUploadPortfolio(request, env, user) {
  try {
    const payload = await request.json();
    let ownerId = user.email;
    let dataToSave = payload;

    if (user.role === 'admin' && payload.target_user_id) {
        ownerId = payload.target_user_id;
        dataToSave = payload.data || payload; 
    }

    const jsonString = JSON.stringify(dataToSave);
    
    await env.DB.prepare(
      "INSERT INTO portfolio_snapshots (user_id, json_data) VALUES (?, ?)"
    ).bind(ownerId, jsonString).run();

    await env.DB.prepare(
      "DELETE FROM portfolio_snapshots WHERE user_id = ? AND id NOT IN (SELECT id FROM portfolio_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT 10)"
    ).bind(ownerId, ownerId).run();

    return jsonResponse({ success: true, message: `Upload success for ${ownerId}` });
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 500);
  }
}

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

/**
 * 修正後的刪除邏輯：
 * 刪除後檢查該使用者是否還有剩餘交易，若為 0 則「連帶清空」快照資料。
 */
async function handleDeleteRecord(req, env, user) {
  const { id } = await req.json();
  
  // 1. 執行刪除交易紀錄
  await env.DB.prepare("DELETE FROM records WHERE id = ? AND user_id = ?").bind(id, user.email).run();

  // 2. 檢查該使用者是否還有剩餘任何紀錄 (包括 BUY, SELL, DIV)
  const check = await env.DB.prepare(
    "SELECT COUNT(*) as total FROM records WHERE user_id = ?"
  ).bind(user.email).first();

  if (check.total === 0) {
    // 3. 若紀錄歸零，強制清空該使用者的所有快照，確保資料一致
    await env.DB.prepare(
      "DELETE FROM portfolio_snapshots WHERE user_id = ?"
    ).bind(user.email).run();

    // 提示前端執行 RELOAD_UI 清空本地緩存
    return jsonResponse({ success: true, message: "RELOAD_UI" });
  }

  return jsonResponse({ success: true });
}

/**
 * ✅ 更新：支援傳遞自訂基準標的 (benchmark) 參數
 * 使用 repository_dispatch 事件來傳遞 client_payload
 */
async function handleGitHubTrigger(req, env, user) {
  if (!env.GITHUB_TOKEN) return jsonResponse({ error: "No Token Configured" }, 500);
  
  // ✅ 讀取 request body 中的 benchmark 參數
  let customBenchmark = 'SPY'; // 預設值
  try {
    const body = await req.json();
    if (body && body.benchmark) {
      customBenchmark = body.benchmark.toUpperCase().trim();
    }
  } catch (e) {
    // 如果沒有 body 或解析失敗，使用預設值
  }
  
  // ✅ 使用 repository_dispatch 而非 workflow_dispatch
  const ghUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`;
  
  const resp = await fetch(ghUrl, { 
      method: 'POST', 
      headers: { 
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
          'Accept': 'application/vnd.github.v3+json', 
          'User-Agent': 'Cloudflare Worker',
          'Content-Type': 'application/json'
      }, 
      body: JSON.stringify({ 
          event_type: 'trigger-update',
          client_payload: {
              custom_benchmark: customBenchmark,
              target_user_id: user.email,
              triggered_at: new Date().toISOString()
          }
      }) 
  });
  
  if (!resp.ok) {
    const errorText = await resp.text();
    return jsonResponse({ 
        success: false, 
        error: `GitHub API Error: ${resp.status}`, 
        details: errorText 
    }, 500);
  }
  
  return jsonResponse({ 
      success: true, 
      benchmark: customBenchmark,
      message: `Triggered update with benchmark: ${customBenchmark}`
  });
}

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