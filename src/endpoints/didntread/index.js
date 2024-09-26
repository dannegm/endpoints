import { Router } from 'express';

// import puppeteer from 'puppeteer';
import got from 'got';

import { scrapper } from './metascraper.js';
import { makePrompt } from './chatgpt.js';

const router = Router();

const prompt = `
    You're going to be a machine that reads an article and gives me in a tweet (no more than
    240 characters), whit no hashtags, what the article's title is promising, saving me from reading all the useless
    filler content. I'll send the articles in markdown.
`;

const readerPrompt = makePrompt({ prompt });

// const getPageUrlContent = async url => {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();
//
//     // Navigate the page to a URL.
//     await page.goto(url);
//     const htmlContent = await page.content();
//     await browser.close();
//
//     return htmlContent;
// };

router.all('/', (req, res) => {
    return res.send('OK - didntread');
});

router.post('/scrapper', async (req, res) => {
    const url = req.body.url;
    const lang = req.query?.lang || 'infer';

    if (!url) {
        return res.status(400).json({ message: 'Missing url' });
    }

    try {
        // const got = (await import('got')).default;

        // const html = await getPageUrlContent(url);
        const { body } = await got(url);
        const { markdown, ...metadata } = await scrapper({ url, html: body });

        const resume = await readerPrompt({ lang, message: markdown });

        return res.status(200).json({
            // ...
            ...metadata,
            resume,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'unexpected error', error });
    }
});

export default router;
