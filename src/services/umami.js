import umami from '@umami/node';

umami.init({
    websiteId: process.env.UMAMI_WEBSITE_ID,
    hostUrl: process.env.UMAMI_WEBSITE_HOST_URL,
});

export { umami };
