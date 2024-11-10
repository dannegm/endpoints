import axios from 'axios';

const OPENAI_API_URL = 'http://localhost:1234';

export const llamaApi = axios.create({
    baseURL: OPENAI_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

const getLangPrompt = ({ lang }) =>
    lang === 'infer'
        ? `Infers the language and responds in that language.`
        : `Localize the answer to the language ${lang}`;

export const makePrompt = ({ prompt }) => {
    return async ({ message, lang = 'infer' }) => {
        const resp = await llamaApi.post('/v1/chat/completions', {
            temperature: 0.7,
            max_tokens: -1,
            stream: false,
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

        console.log(resp.data);

        const choices = resp.data?.choices[0];
        return choices.message.content;
    };
};
