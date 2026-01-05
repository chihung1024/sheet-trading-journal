import { Hono } from 'hono';

const app = new Hono();

// 前端讀取最新報價 (GET)
// 注意：這個路由在主程式中我們可能需要決定是否需要 Auth，目前的架構是公開讀取或 Auth 讀取皆可
// 這裡我們假設需要登入才能看 (繼承主路由的 authMiddleware)，如果想公開可調整 index.js
app.get('/', async (c) => {
    try {
        const result = await c.env.DB.prepare(
            "SELECT json_data FROM portfolio_snapshots ORDER BY id DESC LIMIT 1"
        ).first();

        if (!result) {
            return c.json({ success: true, data: { summary: {}, holdings: [], history: [] } });
        }
        
        const parsedData = JSON.parse(result.json_data);
        return c.json({ success: true, data: parsedData });
    } catch (e) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

// Python 上傳報價 (POST) - 僅限 System Admin
app.post('/', async (c) => {
    const user = c.get('user');
    
    // 權限檢查
    if (user.role !== 'admin') {
        return c.json({ success: false, error: "Unauthorized: Admin only" }, 401);
    }

    try {
        const data = await c.req.json();
        const jsonString = JSON.stringify(data);
        
        // 寫入新資料
        await c.env.DB.prepare(
            "INSERT INTO portfolio_snapshots (json_data) VALUES (?)"
        ).bind(jsonString).run();

        // 清理舊資料 (保留最新的 10 筆)
        await c.env.DB.prepare(
            "DELETE FROM portfolio_snapshots WHERE id NOT IN (SELECT id FROM portfolio_snapshots ORDER BY id DESC LIMIT 10)"
        ).run();

        return c.json({ success: true, message: "Upload success" });
    } catch (e) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

export default app;
