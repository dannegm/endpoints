import axios from 'axios';
import EventSource from 'eventsource';
import { buildCustomLogger } from '@/services/logger';

const logger = buildCustomLogger('ntfy');

const APP_TOPIC = process.env.APP_TOPIC;

class Ntfy {
    constructor(topic) {
        this.topic = topic;

        const ntfyUrl = `https://ntfy.sh/${topic}`;
        this.ntfyUrl = ntfyUrl;
        this.EventSource = new EventSource(`${ntfyUrl}/sse`);
    }

    async pushSimple({ message }) {
        logger.debug(`Sending simple: ${message}`);
        try {
            await axios.post(this.ntfyUrl, message);
            logger.success(`Sent simple: ${message}`);
        } catch (err) {
            logger.error('Error sending notification', err);
        }
    }

    async pushRich({ title, message, tags }) {
        logger.debug(`Sending rich: ${title}`);
        try {
            const fallbackTitle = title || 'DNN Endpoints';
            await axios.post(this.ntfyUrl, message, {
                headers: {
                    Title: fallbackTitle,
                    Tags: tags || 'white_circle',
                    Markdown: 'yes',
                },
            });
            logger.success(`Sent rinch: ${fallbackTitle} | ${message}`);
        } catch (err) {
            logger.error('Error sending notification', err);
        }
    }

    onMessage(handler) {
        this.EventSource.addEventListener('message', event => {
            const data = JSON.parse(event.data);
            logger.info(`Received: ${data.title} | ${data.message}`);
            handler(event);
        });
    }
}

export default new Ntfy(APP_TOPIC);
