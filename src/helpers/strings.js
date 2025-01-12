export const stripedElements = [
    { pattern: /~~(.*?)~~/g, parser: text => text },
    { pattern: /__(.*?)__/g, parser: text => text },
    { pattern: /\/\/(.*?)\/\//g, parser: text => text },
    { pattern: /\*\*(.*?)\*\*/g, parser: text => text },
    { pattern: /::(.*?)::/g, parser: text => text },
    { pattern: /\$\$(.*?)\$\$/g, parser: text => text },
    { pattern: /\~\:(.*?)\:\~/g, parser: text => text },
    { pattern: /\%\%(.*?)\%\%/g, parser: text => text },
    { pattern: /\|\|/g, parser: () => ' ¬ ' },
    { pattern: /\*\/(.*?)\/\*/g, parser: text => text },
    { pattern: /`(.*?)`/g, parser: text => text },
    { pattern: /\{\{(.*?)\|(.*?)\}\}/g, parser: (_, description) => `[${description}]` },
    { pattern: /\{\{(.*?)\}\}/g, parser: url => `[${url}]` },
    { pattern: /\[\[\[\[(.*?)\]\]\]\]/g, parser: id => `[${id}]` },
    { pattern: /\[\[\[(.*?)\]\]\]/g, parser: id => `[${id}]` },
    { pattern: /\[\[(.*?)\]\]/g, parser: id => `[${id}]` },
];

export const parseText = (text, elements) => {
    // Handle escaped characters
    const unescapedText = text.replace(/\\([*~_/:\[\]$])/g, (_, char) => `\0${char}`);

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

    // Restore escaped characters
    return parsedElements.map(segment =>
        typeof segment === 'string' ? segment.replace(/\0([*~_/:\[\]$])/g, '$1') : segment,
    );
};
