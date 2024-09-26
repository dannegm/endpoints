import axios from 'axios';

const OPENAI_API_URL = process.env.DIDNTREAD__OPENAI_API_URL;
const OPENAI_API_KEY = process.env.DIDNTREAD__OPENAI_API_KEY;

export const chatGpetApi = axios.create({
    baseURL: OPENAI_API_URL,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
});

const getLangPrompt = ({ lang }) =>
    lang === 'infer'
        ? `Infers the language and responds in that language.`
        : `Localize the answer to the language ${lang}`;

export const makePrompt = ({ prompt }) => {
    return async ({ message, lang = 'infer' }) => {
        const resp = await chatGpetApi.post('/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: prompt,
                },
                {
                    role: 'system',
                    content: getLangPrompt({ lang }),
                },
                {
                    role: 'user',
                    content: message,
                },
            ],
        });

        const choices = resp.data?.choices[0];
        return choices.message.content;
    };
};
