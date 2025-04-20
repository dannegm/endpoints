export const buildSubdomainRouters = (app, modules) => {
    app.set('subdomain offset', 2);

    const map = new Map();

    for (const key in modules) {
        const subdomains = key.split('|').map(k => (k === '@' ? undefined : k));
        for (const sd of subdomains) {
            map.set(sd, modules[key]);
        }
    }

    app.use((req, res, next) => {
        const sub = req.subdomains[0];
        req.subdomain = sub;
        const router = map.get(sub) || map.get('default');
        if (!router) return res.status(404).send('Subdomain not handled');
        router(req, res, next);
    });

    return app;
};
