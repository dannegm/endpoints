import { extractConfigsAndContent, parseText, stripedElements } from '@/helpers/strings';

export const richQuote = quote => {
    return {
        ...quote,
        quoteStripped: parseText(quote.quote, stripedElements).join(''),
        configs: extractConfigsAndContent(quote.quote).configs,
    };
};
