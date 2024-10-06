import { createLogger, format, transports, addColors } from 'winston';

// Define un nivel personalizado
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        request: 3,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'blue',
        request: 'magenta',
    },
};

addColors(customLevels.colors);

export const logger = createLogger({
    levels: customLevels.levels,
    format: format.combine(format.timestamp(), format.json()),
    transports: [
        new transports.Console({
            level: 'request',
            format: format.combine(format.colorize(), format.simple()),
        }),
        new transports.File({
            filename: 'logs/request.log',
            level: 'request',
            format: format.combine(format.timestamp(), format.json()),
        }),
        new transports.File({
            filename: 'logs/app.log',
            level: 'info',
            format: format.combine(format.timestamp(), format.json()),
        }),
        new transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: format.combine(format.timestamp(), format.json()),
        }),
    ],
});
