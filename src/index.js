import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';

// 引入子路由
import authParams from './routes/auth';
import records from './routes/records';
import portfolio from './routes/portfolio';
import trigger from './routes/trigger';

const app = new Hono();

// 1. 全域中間件
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-KEY'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}));

// 2. 錯誤處理
app.onError((err, c) => {
    console.error(`${err}`);
    return c.json({ success: false, error: err.message }, 500);
});

app.notFound((c) => {
    return c.text('Not Found', 404);
});

// 3. 公開路由 (Public Routes)
// /auth/google 不需要驗證
app.route('/auth', authParams);

// 如果希望 portfolio GET 是公開的，可以放在這裡；若需驗證則往下放
// 這裡將 portfolio 設為部分公開 (GET public / POST private) 的邏輯較複雜，
// 為了簡化，我們將 GET portfolio 放在 public 區域 (假設 Dashboard 可公開訪問)
import portfolioPublic from './routes/portfolio';
// 為了避免與下方重複路由衝突，Hono 建議明確分開。
// 這裡我們採用策略：所有 /api 開頭的都經過 Auth，但 Portfolio GET 若需公開可特例處理
// 為了配合 Phase 1 Python，我們維持 /api/portfolio 的結構


// 4. 受保護路由 (Protected Routes)
// 套用 Auth Middleware 到 /api/*
app.use('/api/*', authMiddleware);

app.route('/api/records', records);
app.route('/api/portfolio', portfolio);
app.route('/api/trigger-update', trigger);

// 根目錄測試
app.get('/', (c) => c.text('Journal API v2 is Running'));

export default app;
