import { Router } from 'express';

import { withApiKey } from '@/helpers/middlewares';

import searchRoutes from './routes/search';
import booksRoutes from './routes/books';
import filesRoutes from './routes/files';
import settingsRoutes from './routes/settings';
import collectionsRoutes from './routes/collections';

const router = Router();

router.use(withApiKey(process.env.BOOKWORMS__APP_KEY || ''));

router.all('/', (req, res) => res.send('OK - bookworms'));

router.use(searchRoutes);
router.use(booksRoutes);
router.use(filesRoutes);
router.use(settingsRoutes);
router.use(collectionsRoutes);

export default router;
