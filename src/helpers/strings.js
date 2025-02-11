export const stripedElements = [
    { pattern: /~~(.*?)~~/g, parser: text => text },
    { pattern: /__(.*?)__/g, parser: text => text },
    { pattern: /\/\/(.*?)\/\//g, parser: text => text },
    { pattern: /\*\*(.*?)\*\*/g, parser: text => text },
    { pattern: /---(.*?)---/g, parser: text => text },
    { pattern: /\+\+\+(.*?)\+\+\+/g, parser: text => text },
    { pattern: /::(.*?)::/g, parser: text => text },
    { pattern: /\$\$(.*?)\$\$/g, parser: text => text },
    { pattern: /\~\:(.*?)\:\~/g, parser: text => text },
    { pattern: /\%\%(.*?)\%\%/g, parser: text => text },
    { pattern: /\$\@(.*?)\@\$/g, parser: text => text },
    { pattern: /\º\º(.*?)\º\º/g, parser: text => text },
    { pattern: /<<([^>]+)>>/g, parser: match => match.split('|').join(', ') },
    { pattern: /\|\|/g, parser: () => ' ¬ ' },
    { pattern: /\*\/(.*?)\/\*/g, parser: text => text },
    { pattern: /`(.*?)`/g, parser: text => text },
    { pattern: /\{\{(.*?)\|(.*?)\}\}/g, parser: (_, description) => `[${description}]` },
    { pattern: /\{\{(.*?)\}\}/g, parser: url => `[${url}]` },
    { pattern: /\[\[\[\[(.*?)\]\]\]\]/g, parser: id => `[${id}]` },
    { pattern: /\[\[\[(.*?)\]\]\]/g, parser: id => `[${id}]` },
    { pattern: /\[\[(.*?)\]\]/g, parser: id => `[${id}]` },
];

export const extractConfigs = (configsText = null) => {
    if (!configsText) return null;

    return configsText
        .trim()
        .split('|')
        .map(i => i.trim())
        .reduce((a, c) => {
            const [key, ...value] = c.split(':');
            a[key] = value.join(':') ?? true;
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
