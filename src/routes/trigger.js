import { Hono } from 'hono';

const app = new Hono();

app.post('/', async (c) => {
    const env = c.env;
    
    if (!env.GITHUB_TOKEN) {
        return c.json({ error: "Server Configuration Error: No Token" }, 500);
    }

    const ghUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/update.yml/dispatches`;
    
    try {
        const resp = await fetch(ghUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Cloudflare Worker'
            },
            body: JSON.stringify({ ref: 'main' })
        });

        if (resp.status >= 200 && resp.status < 300) {
            return c.json({ success: true });
        } else {
            return c.json({ success: false, error: `GitHub API Error: ${resp.status}` }, 500);
        }
    } catch (e) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

export default app;
