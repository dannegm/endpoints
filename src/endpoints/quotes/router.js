import { Router } from 'express';
import { quotesRouter } from './quotes';
import { actionsRouter } from './actions';
import { sessionsRouter } from './sessions';

const router = Router();

router.all('/', (req, res) => {
    return res.send('OK - quotes');
});

const registerRouters = (instance, routers) =>
    routers.reduce(($instance, $router) => {
        return $router($instance);
    }, instance);

export default registerRouters(router, [
    // ...
    sessionsRouter,
    actionsRouter,
    quotesRouter,
]);
