import metascraper from 'metascraper';

import metascraperAuthor from 'metascraper-author';
import metascraperDate from 'metascraper-date';
import metascraperDescription from 'metascraper-description';
import metascraperImage from 'metascraper-image';
import metascraperLogo from 'metascraper-logo';
import metascraperClearbit from 'metascraper-clearbit';
import metascraperPublisher from 'metascraper-publisher';
import metascraperTitle from 'metascraper-title';
import metascraperUrl from 'metascraper-url';

import TurndownService from 'turndown';
import { memoizeOne } from '@metascraper/helpers';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const htmlToMarkdown = memoizeOne(({ htmlDom: $ }) => {
    const dom = new JSDOM($.html());
    const article = new Readability(dom.window.document).parse();
    const turndown = new TurndownService();

    const tagsBlacklist = [
        'a',
        'aside',
        'nav',
        'form',
        'header',
        'footer',
        'style',
        'script',
        'noscript',
    ];
    tagsBlacklist.forEach(tag => turndown.remove(tag));
    turndown.addRule('header', {
        filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        replacement: (content, node) => {
            const level = parseInt(node.nodeName.charAt(1));
            return `${'#'.repeat(level)} ${content}\n\n`;
        },
    });
    turndown.addRule('removeExtraLineBreaks', {
        filter: node => node.nodeName === 'P' || node.nodeName === 'BR',
        replacement: content => content.trim(),
    });

    const markdown = `# ${article.title} \n\n` + turndown.turndown(article.content);
    return markdown;
});

const metascraperMarkdown = () => ({
    markdown: htmlToMarkdown,
});

export const scrapper = metascraper([
    metascraperAuthor(),
    metascraperDate(),
    metascraperDescription(),
    metascraperImage(),
    metascraperLogo(),
    metascraperClearbit(),
    metascraperPublisher(),
    metascraperTitle(),
    metascraperUrl(),
    metascraperMarkdown(),
]);
