import { Hono } from 'hono';

const app = new Hono();

// 獲取交易紀錄 (GET)
app.get('/', async (c) => {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
        "SELECT * FROM records WHERE user_id = ? ORDER BY txn_date DESC, created_at DESC LIMIT 1000"
    ).bind(user.email).all();
    
    return c.json({ success: true, data: results });
});

// 新增交易紀錄 (POST)
app.post('/', async (c) => {
    const user = c.get('user');
    const b = await c.req.json();
    
    await c.env.DB.prepare(
        "INSERT INTO records (user_id, txn_date, symbol, txn_type, qty, price, fee, tag, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
        user.email, 
        b.txn_date, 
        b.symbol.toUpperCase(), 
        b.txn_type, 
        b.qty, 
        b.price, 
        b.fee || 0, 
        b.tag || 'Stock', 
        b.note || ''
    ).run();

    return c.json({ success: true });
});

// 更新交易紀錄 (PUT)
app.put('/', async (c) => {
    const user = c.get('user');
    const b = await c.req.json();

    await c.env.DB.prepare(
        "UPDATE records SET txn_date=?, symbol=?, txn_type=?, qty=?, price=?, fee=?, tag=?, note=? WHERE id=? AND user_id=?"
    ).bind(
        b.txn_date, 
        b.symbol.toUpperCase(), 
        b.txn_type, 
        b.qty, 
        b.price, 
        b.fee || 0, 
        b.tag || 'Stock', 
        b.note || '', 
        b.id, 
        user.email
    ).run();

    return c.json({ success: true });
});

// 刪除交易紀錄 (DELETE)
app.delete('/', async (c) => {
    const user = c.get('user');
    const { id } = await c.req.json();

    await c.env.DB.prepare(
        "DELETE FROM records WHERE id = ? AND user_id = ?"
    ).bind(id, user.email).run();

    return c.json({ success: true });
});

export default app;
