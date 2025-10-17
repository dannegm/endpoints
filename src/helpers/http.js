import axios from 'axios';
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

export const getClientIp = req => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        return ips[0];
    }
    return req.connection.remoteAddress || req.socket.remoteAddress || req.ip || 'unknown';
};

export const getClientData = async req => {
    console.log('Fetching client data...');
    const { ua, sid } = req.query;

    const ip = getClientIp(req);
    let ip_location = 'unknown';
    let ip_info = null;

    if (ip !== 'unknown') {
        try {
            const { data } = await axios.get(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
            ip_location = data.city
                ? `${data.city}, ${data.region}, ${data.country}`
                : 'unknown (unlocalized)';
            ip_info = data;
        } catch (error) {
            if (error.status === 429) {
                ip_location = 'unknown (not fetched)';
                console.error('Rate limit exceeded while fetching IP location');
            } else {
                ip_location = 'unknown (error)';
                console.error('Error fetching IP location');
            }
        }
    }

    const user_agent = ua || req.headers['user-agent'] || 'unknown';
    const referer = req.headers['referer'] || '';
    const session_id = sid || req.cookies?.session_id || null;

    const protocol = req.protocol;
    const host = req.get('host');
    const path = req.originalUrl;
    const method = req.method;
    const timestamp = new Date().toISOString();
    const is_secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const accept_language = req.headers['accept-language'] || 'unknown';

    return {
        ip,
        ip_location,
        ip_info,
        user_agent,
        referer,
        session_id,
        protocol,
        method,
        path,
        host,
        timestamp,
        is_secure,
        accept_language,
    };
};
