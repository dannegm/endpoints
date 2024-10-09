import { createLogger, format, transports, addColors } from 'winston';
import { upperCase, kebabCase } from 'lodash';
import clc from 'cli-color';

const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        success: 3,
        info: 4,
        request: 4,
        debug: 5,
        verbose: 6,
        silly: 6,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        success: 'green',
        info: 'cyan',
        request: 'blue',
        debug: 'gray',
        verbose: 'gray',
        silly: 'gray',
    },
};

addColors(customLevels.colors);

const consoleFormat = (tag = 'logger') =>
    format.printf(({ level, message }) => {
        const coloredTag = clc.magenta(`[${upperCase(tag)}]`);
        const timestamp = new Date().toISOString();
        return `${clc.blackBright(timestamp)} ${coloredTag} ${level}: ${message}`;
    });

const buildCustomLogger = tag => {
    const filename = kebabCase(tag);

    return createLogger({
        levels: customLevels.levels,
        transports: [
            new transports.Console({
                level: 'info',
                format: format.combine(format.colorize(), consoleFormat(tag)),
            }),
            new transports.File({
                filename: `logs/${filename}.log`,
                level: 'info',
                format: format.combine(format.timestamp(), format.json()),
            }),
            new transports.File({
                filename: `logs/${filename}.error.log`,
                level: 'error',
                format: format.combine(format.timestamp(), format.json()),
            }),
        ],
    });
};

const logger = buildCustomLogger('app');

export { logger, buildCustomLogger };
