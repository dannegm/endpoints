import axios from 'axios';
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

export const getClientIp = req => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        return ips[0];
    }
    return req.connection.remoteAddress || req.socket.remoteAddress;
};

export const getClientData = async req => {
    const { ua, sid } = req.query;

    const ip = getClientIp(req);
    let ip_location = 'unknown';
    let ip_info = null;

    try {
        if (ip !== 'unknown') {
            const { data } = await axios.get(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
            ip_info = data;
            ip_location = data.city ? `${data.city}, ${data.region}, ${data.country}` : 'unknown';
        }
    } catch (error) {
        console.error('Error fetching IP info');
    }

    const user_agent = ua || req.headers['user-agent'] || 'unknown';
    const referer = req.headers['referer'] || '';
    const session_id = sid;

    return {
        ip,
        ip_location,
        ip_info,
        user_agent,
        referer,
        session_id,
    };
};
