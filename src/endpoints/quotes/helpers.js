import { extractConfigsAndContent, parseText, stripedElements } from '@/helpers/strings';

export const richQuote = quote => {
    return {
        ...quote,
        quoteStripped: parseText(quote.quote, stripedElements).join(''),
        configs: extractConfigsAndContent(quote.quote).configs,
    };
};

export const richPost = post => {
    return {
        ...post,
        contentStripped: parseText(post.content, stripedElements).join(''),
        configs: extractConfigsAndContent(post.settings).configs,
    };
};
