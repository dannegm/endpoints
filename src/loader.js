import fs from 'fs';
import path from 'path';
import ntfy from './services/ntfy';
import { blacklist } from './allowed-list';
import { logger } from './services/logger';

const isProduction = process.env.NODE_ENV === 'production';

export const makeLoader = async app => {
    const endpointsDir = path.join(__dirname, './endpoints');
    const folders = fs.readdirSync(endpointsDir);

    for (const folder of folders) {
        if (blacklist.includes(folder)) {
            logger.debug(`/${folder} blacklisted, mount skipped.`);
            continue;
        }

        const routerPath = path.join(endpointsDir, folder, 'router.js');

        if (fs.existsSync(routerPath)) {
            const { default: router } = await import(`./endpoints/${folder}/router`);
            app.use(`/${folder}`, router);
            logger.info(`/${folder} module mounted.`);

            if (isProduction) {
                ntfy.pushRich({
                    title: 'DNN Endpoints Deploy',
                    message: `/${folder} module mounted.`,
                });
            }
        }
    }

    return app;
};
