import { camelCase } from 'lodash';

export const pascalCase = str => {
    const camel = camelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
};

export const stripedElements = [
    { pattern: /~~(.*?)~~/g, parser: text => text },
    { pattern: /__(.*?)__/g, parser: text => text },
    { pattern: /\/\/(.*?)\/\//g, parser: text => text },
    { pattern: /\*\*(.*?)\*\*/g, parser: text => text },
    { pattern: /-:(.*?):-/g, parser: text => text },
    { pattern: /\+:(.*?):\+/g, parser: text => text },
    { pattern: /\$\$(.*?)\$\$/g, parser: text => text },
    { pattern: /\~\:(.*?)\:\~/g, parser: text => text },
    { pattern: /\%\%(.*?)\%\%/g, parser: text => text },
    { pattern: /\$\@(.*?)\@\$/g, parser: text => text },
    { pattern: /\ºº(.*?)ºº/g, parser: text => text },
    { pattern: /\|\|/g, parser: () => ' ¬ ' },
    { pattern: /---\s?(.*?)\s?---/g, parser: icon => `\n-- [${icon}] --\n` },
    { pattern: /---/g, parser: () => '\n---\n' },
    { pattern: /\*\/(.*?)\/\*/g, parser: text => text },
    { pattern: /`(.*?)`/g, parser: text => `\n\`\`\`${text}\`\`\`\n` },
    { pattern: /`(.*?)`/g, parser: text => `\`${text}\`` },
    { pattern: /<mark>(.*?)<\/mark>/g, parser: text => text },
    { pattern: /<quote>(.*?)<\/quote>/g, parser: text => `\n> ${text}\n` },
    {
        pattern: /<quote::(.*?)>(.*?)<\/quote>/g,
        parser: (author, text) => `\n> ${text}\n>${author}\n`,
    },
    { pattern: /<words::([^>]+)>/g, parser: match => match.split('|').join(', ') },
    { pattern: /<icon::(.*?)>/g, parser: name => `[${name}]` },
    { pattern: /<link::(.*?)>(.*?)<\/link>/g, parser: (url, label) => `[${label}](${url})` },
    { pattern: /<ilink::(.*?)>(.*?)<\/ilink>/g, parser: (url, label) => `[${label}](${url})` },
    { pattern: /<blink::(.*?)>(.*?)<\/blink>/g, parser: (url, label) => `[${label}](${url})` },
    { pattern: /<iblink::(.*?)>(.*?)<\/iblink>/g, parser: (url, label) => `[${label}](${url})` },
    { pattern: /<button::(.*?)>(.*?)<\/button>/g, parser: (_, label) => `[${label}]` },
    {
        pattern: /<polaroid::(.*?)>(.*?)<\/polaroid>/g,
        parser: (url, description) => `![${description}](${url})`,
    },
    { pattern: /<polaroid::(.*?)>/g, parser: url => `!(${url})` },
    { pattern: /<spotify::(.*?)>/g, parser: uri => uri },
    { pattern: /<sticker::(.*?)>/g, parser: id => `[${id}]` },
    { pattern: /<badge::(.*?)>/g, parser: id => `[${id}]` },
    { pattern: /\[\[(.*?)\]\]/g, parser: id => `[${id}]` },
    {
        pattern: /<app::(.*?)\(\{(.*?)\}\)>/g,
        parser: (name, args) => {
            const props = extractConfigs(args);
            return `<${pascalCase(name)} props={${JSON.stringify(props)}} />`;
        },
    },
    {
        pattern: /<app::(.*?)\((.*?)\)>/g,
        parser: (name, input) => `<${pascalCase(name)} input="${input}" />`,
    },
    { pattern: /<app::(.*?)>/g, parser: name => `<${pascalCase(name)} />` },
];

export const extractConfigs = (configsText = null) => {
    if (!configsText) return null;

    return configsText
        .trim()
        .split('|')
        .map(i => i.trim())
        .reduce((a, c) => {
            const [key, ...value] = c.split(':');
            a[key] = value.join(':') !== '' ? value.join(':') : true;
            return a;
        }, {});
};

export const extractConfigsAndContent = text => {
    const regex = /^\(\{(.*?)\}\)/;
    const match = text.match(regex);

    if (match) {
        const configs = extractConfigs(match[1]);
        return {
            configs,
            content: text.slice(match[0].length).trim(),
        };
    }

    return {
        configs: null,
        content: text,
    };
};

export const parseText = (text, elements) => {
    const { content } = extractConfigsAndContent(text);
    const unescapedText = content.replace(/\\([*~_/:\[\]$])/g, (_, char) => `\0${char}`);

    let parsedElements = [unescapedText];

    elements.forEach(({ pattern, parser }) => {
        parsedElements = parsedElements.flatMap(segment => {
            if (typeof segment !== 'string') return segment;
            const parts = [];
            let match;
            let lastIndex = 0;

            while ((match = pattern.exec(segment)) !== null) {
                parts.push(segment.slice(lastIndex, match.index));
                const [matcher, ...params] = match;
                parts.push(parser(...params, matcher));
                lastIndex = pattern.lastIndex;
            }

            parts.push(segment.slice(lastIndex));
            return parts;
        });
    });

    return parsedElements.map(segment =>
        typeof segment === 'string' ? segment.replace(/\0([*~_/:\[\]$])/g, '$1') : segment,
    );
};
