import { Hono } from 'hono';
import { verifyGoogleToken } from '../utils/google-jwt';

const app = new Hono();
const GOOGLE_CLIENT_ID = "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com";

app.post('/google', async (c) => {
    try {
        const body = await c.req.json();
        const { id_token } = body;
        
        const payload = await verifyGoogleToken(id_token, GOOGLE_CLIENT_ID);
        
        return c.json({ 
            success: true, 
            user: payload.name, 
            email: payload.email, 
            token: id_token 
        });
    } catch (err) {
        return c.json({ success: false, error: "驗證失敗: " + err.message }, 401);
    }
});

export default app;
