import { verifyGoogleToken } from '../utils/google-jwt';

const GOOGLE_CLIENT_ID = "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com";

export const authMiddleware = async (c, next) => {
    const env = c.env;
    const req = c.req;

    // 1. 檢查 API Key (System Admin / Python Script)
    const apiKey = req.header("X-API-KEY");
    if (apiKey && env.API_SECRET && apiKey === env.API_SECRET) {
        c.set('user', { 
            email: env.ADMIN_EMAIL || 'admin@system', 
            name: "System Admin",
            role: 'admin'
        });
        await next();
        return;
    }

    // 2. 檢查 Google Token (Web User)
    const authHeader = req.header("Authorization");
    if (authHeader) {
        try {
            const token = authHeader.split(" ")[1];
            const payload = await verifyGoogleToken(token, GOOGLE_CLIENT_ID);
            
            c.set('user', { 
                email: payload.email, 
                name: payload.name,
                role: 'user'
            });
            await next();
            return;
        } catch (e) {
            return c.json({ success: false, error: "Invalid Token: " + e.message }, 401);
        }
    }

    // 3. 驗證失敗
    return c.json({ success: false, error: "Unauthorized" }, 401);
};
