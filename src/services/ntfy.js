import { buildCustomLogger } from '@/services/logger';

const logger = buildCustomLogger('ntfy');

const HEARTBEAT_INTERVAL = 60_000;
const MAX_RETRY_DELAY = 30_000;
const INITIAL_RETRY_DELAY = 1_000;
const PUSH_RETRIES = 3;
const PUSH_TIMEOUT = 10_000;

const APP_TOPIC = process.env.APP_TOPIC;

class Ntfy {
    constructor(topic) {
        this.topic = topic;
        this.ntfyUrl = `https://ntfy.sh/${topic}`;
        this._handlers = [];
        this._ws = null;
        this._retryDelay = INITIAL_RETRY_DELAY;
        this._stopped = false;
        this._heartbeat = null;
        this._lastActivity = 0;
    }

    connect() {
        if (this._stopped) return;

        this._ws = new WebSocket(`wss://ntfy.sh/${this.topic}/ws`);

        this._ws.onopen = () => {
            this._retryDelay = INITIAL_RETRY_DELAY;
            this._lastActivity = Date.now();
            logger.info(`Connected to topic: ${this.topic}`);
            this._heartbeat = setInterval(() => {
                const idleMs = Date.now() - this._lastActivity;
                const isStale =
                    this._ws.readyState !== WebSocket.OPEN || idleMs > HEARTBEAT_INTERVAL * 2;
                if (isStale) {
                    this._ws.close();
                }
            }, HEARTBEAT_INTERVAL);
        };

        this._ws.onmessage = event => {
            this._lastActivity = Date.now();
            try {
                const data = JSON.parse(event.data);
                if (data.event === 'message') {
                    logger.info(`Received: ${data.title} | ${data.message}`);
                    this._handlers.forEach(h => h(data));
                }
            } catch (_) {}
        };

        this._ws.onclose = () => {
            clearInterval(this._heartbeat);
            if (this._stopped) return;
            logger.warn(`Disconnected, reconnecting in ${this._retryDelay}ms`);
            setTimeout(() => this.connect(), this._retryDelay);
            this._retryDelay = Math.min(this._retryDelay * 2, MAX_RETRY_DELAY);
        };

        this._ws.onerror = event => {
            logger.error(`WebSocket error: ${event.error?.message}`);
            this._ws.close();
        };
    }

    async _push(body, headers = {}) {
        let retryDelay = INITIAL_RETRY_DELAY;
        for (let attempt = 1; attempt <= PUSH_RETRIES; attempt++) {
            try {
                const res = await fetch(this.ntfyUrl, {
                    method: 'POST',
                    body,
                    headers,
                    signal: AbortSignal.timeout(PUSH_TIMEOUT),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return;
            } catch (err) {
                logger.error(`Push attempt ${attempt} failed: ${err.message}`);
                if (attempt < PUSH_RETRIES) {
                    await new Promise(r => setTimeout(r, retryDelay));
                    retryDelay *= 2;
                }
            }
        }
    }

    async pushSimple({ message }) {
        logger.debug(`Sending simple: ${message}`);
        await this._push(message);
    }

    async pushRich({ title, message, tags, click = undefined }) {
        logger.debug(`Sending rich: ${title}`);
        const fallbackTitle = title || 'DNN Endpoints';
        const headers = {
            Title: fallbackTitle,
            Tags: tags || 'white_circle',
            Markdown: 'yes',
        };
        if (click) {
            headers.Click = click;
        }
        await this._push(message, headers);
    }

    onMessage(handler) {
        this._handlers.push(handler);
    }

    disconnect() {
        this._stopped = true;
        clearInterval(this._heartbeat);
        this._ws?.close();
    }
}

export { Ntfy };

const ntfy = new Ntfy(APP_TOPIC);
ntfy.connect();
export default ntfy;
