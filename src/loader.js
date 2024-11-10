import fs from 'fs';
import path from 'path';
import ntfy from './services/ntfy';

export const makeLoader = async app => {
    const endpointsDir = path.join(__dirname, './endpoints');
    const folders = fs.readdirSync(endpointsDir);

    for (const folder of folders) {
        const routerPath = path.join(endpointsDir, folder, 'router.js');

        if (fs.existsSync(routerPath)) {
            const { default: router } = await import(`./endpoints/${folder}/router`);
            app.use(`/${folder}`, router);
            ntfy.pushRich({
                title: 'DNN Endpoints Deploy',
                message: `/${folder} mounted...`,
            });
        }
    }

    return app;
};
