import axios from 'axios';

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

export const createSimpleMemoryHandler = () => {
    let memory = [];
    return {
        getMemory: () => memory,
        updateMemory: newMemory => {
            memory = newMemory;
        },
        clearMemory: () => {
            memory = [];
        },
    };
};

export const createIpMemoryHandler = () => {
    let memory = {};
    return ip => {
        memory[ip] ??= [];
        return {
            getMemory: () => memory[ip],
            updateMemory: newMemory => {
                memory[ip] = newMemory;
            },
            clearMemory: () => {
                memory[ip] = [];
            },
        };
    };
};

export const getIp = req => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
};

export const getClientData = async req => {
    const { ua, sid } = req.query;

    const ip = getIp(req);
    let ip_location = 'unknown';
    let ip_info = null;

    if (ip !== 'unknown') {
        const { data } = await axios.get(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
        ip_info = data;
        ip_location = data.city ? `${data.city}, ${data.region}, ${data.country}` : 'unknown';
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
