import fs from 'fs/promises';
import { Router } from 'express';
import multer from 'multer';
import OpenAI from 'openai';

import { parse, subDays, isWithinInterval } from 'date-fns';

const router = Router();

const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const IA_MODEL = 'gpt-4o-mini';

const extractDateTime = input => {
    const match = input.match(/\[(.*?)\]/g);
    return match?.[0] ? parse(match[0], '[dd/MM/yy, HH:mm:ss]', new Date()) : null;
};

const readFileLines = async filePath => {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        await fs.unlink(filePath);
        return data
            .split('\n')
            .map(line => line.trim())
            .filter(line => line);
    } catch (error) {
        throw new Error('Error reading file');
    }
};

const filterByDate = (start, end) => line => {
    const date = extractDateTime(line);
    return date && isWithinInterval(date, { start, end });
};

const preparePromp = prompt => `
# Prompt
${prompt}
`;

const prepareConversation = messages => `
# Conversación
${messages.join('\n')}
`;

const analyzeChat = async (prompt, messages) => {
    try {
        const response = await openai.chat.completions.create({
            model: IA_MODEL,
            messages: [
                {
                    role: 'system',
                    content:
                        'Te mandaré un prompt y una conversación. El contenido se mandará en secciones, "# Prompt" para indicarte las instrucciones y "# Conversación" para la conversación. Con base a la conversación, harás un analisis que se indique en el prompt y me darás el resultado. Trata de ser puntual, no te extiendas mucho.',
                },
                {
                    role: 'system',
                    content:
                        'Krys es Krystel Virginia Camacho Rivas y Dan es Edwing Daniel García Martínez. Puedes inferir a estas personas por las variantes de sus nombres.',
                },
                { role: 'system', content: preparePromp(prompt) },
                { role: 'user', content: prepareConversation(messages) },
            ],
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.log(error);
        throw new Error(error);
    }
};

router.all('/', (req, res) => {
    return res.send('OK - mindreader');
});

router.post('/analyze', upload.single('conversation'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!req.body.prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const lines = await readFileLines(req.file.path);
        const { startDate, endDate, prompt } = req.body;
        const start = startDate ? new Date(startDate) : subDays(new Date(), 15);
        const end = endDate ? new Date(endDate) : new Date();

        const filteredMessages = lines
            .filter(filterByDate(start, end))
            .filter(t => !t.includes('imagen omitida'));
        const sanitizeMessages = filteredMessages.map(msg => {
            return msg
                .replace(/^\[\d{2}\/\d{2}\/\d{2}, \d{2}:\d{2}:\d{2}\]\s*/, '')
                .replaceAll('Krystel', 'Krys')
                .replaceAll('Daniel García', 'Dan')
                .replaceAll('<Se editó este mensaje.>', '')
                .replace(/\u200E/g, '')
                .trim();
        });
        const analysis = await analyzeChat(prompt, sanitizeMessages);

        res.json({
            start,
            end,
            analysis,
            // conversation: sanitizeMessages,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
