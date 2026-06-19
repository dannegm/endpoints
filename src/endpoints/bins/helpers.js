import { join } from 'path';

export const MIME_TYPES = {
    markdown:   'text/markdown',
    javascript: 'text/javascript',
    typescript: 'application/typescript',
    jsx:        'text/jsx',
    tsx:        'text/tsx',
    html:       'text/html',
    css:        'text/css',
    scss:       'text/x-scss',
    json:       'application/json',
    yaml:       'application/yaml',
    toml:       'application/toml',
    python:     'text/x-python',
    rust:       'text/x-rustsrc',
    go:         'text/x-go',
    java:       'text/x-java-source',
    php:        'application/x-php',
    ruby:       'text/x-ruby',
    swift:      'text/x-swift',
    kotlin:     'text/x-kotlin',
    bash:       'application/x-sh',
    sql:        'application/sql',
    graphql:    'application/graphql',
    dockerfile: 'text/x-dockerfile',
    xml:        'application/xml',
    c:          'text/x-csrc',
    cpp:        'text/x-c++src',
    csharp:     'text/x-csharp',
    plaintext:  'text/plain',
};

export const LANGUAGES = {
    markdown:   { icon: 'markdown-plain',        color: '#083fa1', label: 'Markdown'   },
    javascript: { icon: 'javascript-plain',      color: '#f7df1e', label: 'JavaScript' },
    typescript: { icon: 'typescript-plain',      color: '#3178c6', label: 'TypeScript' },
    jsx:        { icon: 'react-original',        color: '#61dafb', label: 'JSX'        },
    tsx:        { icon: 'react-original',        color: '#61dafb', label: 'TSX'        },
    html:       { icon: 'html5-plain',           color: '#e34f26', label: 'HTML'       },
    css:        { icon: 'css3-plain',            color: '#1572b6', label: 'CSS'        },
    scss:       { icon: 'sass-plain',            color: '#c6538c', label: 'SCSS'       },
    json:       { icon: 'json-plain',            color: '#292929', label: 'JSON'       },
    yaml:       { icon: 'yaml-plain',            color: '#cb171e', label: 'YAML'       },
    toml:       { icon: null,                    color: '#9c4121', label: 'TOML'       },
    python:     { icon: 'python-plain',          color: '#3776ab', label: 'Python'     },
    rust:       { icon: 'rust-plain',            color: '#dea584', label: 'Rust'       },
    go:         { icon: 'go-plain',              color: '#00add8', label: 'Go'         },
    java:       { icon: 'java-plain',            color: '#ed8b00', label: 'Java'       },
    php:        { icon: 'php-plain',             color: '#777bb4', label: 'PHP'        },
    ruby:       { icon: 'ruby-plain',            color: '#cc342d', label: 'Ruby'       },
    swift:      { icon: 'swift-plain',           color: '#f05138', label: 'Swift'      },
    kotlin:     { icon: 'kotlin-plain',          color: '#7f52ff', label: 'Kotlin'     },
    bash:       { icon: 'bash-plain',            color: '#4eaa25', label: 'Bash'       },
    sql:        { icon: 'azuresqldatabase-plain',color: '#d9272e', label: 'SQL'        },
    graphql:    { icon: 'graphql-plain',         color: '#e10098', label: 'GraphQL'    },
    dockerfile: { icon: 'docker-plain',          color: '#2496ed', label: 'Dockerfile' },
    xml:        { icon: 'xml-plain',             color: '#fb8c00', label: 'XML'        },
    c:          { icon: 'c-plain',               color: '#a8b9cc', label: 'C'          },
    cpp:        { icon: 'cplusplus-plain',       color: '#00599c', label: 'C++'        },
    csharp:     { icon: 'csharp-plain',          color: '#239120', label: 'C#'         },
    plaintext:  { icon: null,                    color: '#888888', label: 'Text'       },
};

export const getLangFg = hex => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a1a' : '#ffffff';
};

let fontsCache = null;
const iconCache = new Map();

export async function getFonts() {
    if (fontsCache) return fontsCache;
    const dir = join(import.meta.dir, '../../../node_modules/@fontsource');
    const [regular, semibold, mono] = await Promise.all([
        Bun.file(join(dir, 'geist/files/geist-latin-400-normal.woff')).arrayBuffer(),
        Bun.file(join(dir, 'geist/files/geist-latin-600-normal.woff')).arrayBuffer(),
        Bun.file(join(dir, 'geist-mono/files/geist-mono-latin-400-normal.woff')).arrayBuffer(),
    ]);
    fontsCache = [
        { name: 'Geist', data: regular, weight: 400, style: 'normal' },
        { name: 'Geist', data: semibold, weight: 600, style: 'normal' },
        { name: 'Geist Mono', data: mono, weight: 400, style: 'normal' },
    ];
    return fontsCache;
}

export async function fetchIcon(language) {
    const lang = LANGUAGES[language];
    if (!lang) return null;

    const fallback = { uri: null, color: lang.color, label: lang.label };
    if (!lang.icon) return fallback;

    const cacheKey = lang.icon;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);

    try {
        const id = lang.icon;
        const name = id.slice(0, id.lastIndexOf('-'));
        const variant = id.slice(id.lastIndexOf('-') + 1);
        const variants = [variant, variant === 'plain' ? 'original' : 'plain'];
        const fg = getLangFg(lang.color);

        for (const v of variants) {
            const res = await fetch(
                `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${name}/${name}-${v}.svg`,
            );
            if (!res.ok) continue;
            const raw = await res.text();
            const colored = raw.replace(/fill="(?!none)([^"]*)"/g, `fill="${fg}"`);
            const result = { uri: `data:image/svg+xml;base64,${Buffer.from(colored).toString('base64')}`, color: lang.color, label: lang.label };
            iconCache.set(cacheKey, result);
            return result;
        }
        throw new Error('not found');
    } catch {
        iconCache.set(cacheKey, fallback);
        return fallback;
    }
}

export async function fetchAvatar(seed, bgColor) {
    const color = (bgColor ?? '#f39c12').replace('#', '');
    const res = await fetch(
        `https://api.dicebear.com/9.x/rings/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${color}`,
    );
    const svg = await res.text();
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
