import { getClientData } from './handlers';
import { umami as UmamiService } from '../services/umami';

export const clientInfo = () => async (req, res, next) => {
    const clientData = await getClientData(req);
    req.clientData = clientData;
    next();
};

export const umami = () => (req, res, next) => {
    const clientData = req.clientData || {};

    UmamiService.track({
        name: 'request',
        url: req.originalUrl,
        referrer: clientData?.referrer,
        data: {
            ip: clientData?.ip,
            ip_info: clientData?.ip_info,
            location: clientData?.ip_location,
            user_agent: clientData?.user_agent,
        },
    });

    next();
};
