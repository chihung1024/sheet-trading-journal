/**
 * Cloudflare Worker v2.39 - Portfolio Data Gateway
 * [v14.0 Asset Value Approach]
 * * 功能：
 * 1. 提供前端 Vue.js 獲取最新的投資組合快照數據 (JSON)。
 * 2. 處理 CORS 預檢請求。
 * 3. 確保數據以正確的 Content-Type 回傳。
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // 1. 處理 CORS 預檢請求 (Preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // 2. 路由處理：獲取投資組合數據
    // 路徑支援: / 或 /api/portfolio
    if (path === "/" || path === "/api/portfolio" || path === "/values/portfolio_data") {
      
      // 從 KV 命名空間中讀取資料
      // 注意：PORTFOLIO_KV 必須在 Worker 設定中綁定至 Namespace ID
      const data = await PORTFOLIO_KV.get("portfolio_data");

      if (data === null) {
        return new Response(JSON.stringify({
          error: "Data not found",
          message: "尚未有任何計算快照上傳至 KV。"
        }), {
          status: 404,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json;charset=UTF-8"
          }
        });
      }

      // 成功回傳資料
      return new Response(data, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json;charset=UTF-8",
          "Cache-Control": "no-cache, no-store, must-revalidate", // 確保匯率即時性，不快取
        }
      });
    }

    // 3. 處理其他不支援的路徑
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      }
    });

  } catch (err) {
    // 4. 錯誤捕捉
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      message: err.message
    }), {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      }
    });
  }
}
