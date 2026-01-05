/**
 * Google JWT 驗證邏輯 (Native Web Crypto)
 * 移植自原專案，保持原汁原味
 */

export async function verifyGoogleToken(token, aud) {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid Token Format");
  
    // 1. 解析 Header
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    // 2. 解析 Payload
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  
    // 3. 檢查 Audience 和過期時間
    if (payload.aud !== aud) throw new Error("Invalid Audience");
    if (payload.exp < Math.floor(Date.now()/1000)) throw new Error("Expired Token");
  
    // 4. 獲取 Google 公鑰
    const keysResp = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    const keys = await keysResp.json();
    const key = keys.keys.find(k => k.kid === header.kid);
    if (!key) throw new Error("Key not found");
  
    // 5. 驗證簽章
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
