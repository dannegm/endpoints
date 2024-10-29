const API_KEY = process.env.BOOKWORMS__APP_KEY;

export const apiKeyMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-dnn-apikey'];

    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Invalid API Key' });
    }

    req.apiKey = apiKey;

    next();
};
