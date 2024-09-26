import starfish from './endpoints/starfish';
import didntread from './endpoints/didntread';

export const makeLoader = app => {
    app.use('/starfish', starfish);
    app.use('/didntread', didntread);

    return app;
};
