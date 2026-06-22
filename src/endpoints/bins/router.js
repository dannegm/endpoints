import { Router } from 'express';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import filesRouter from './routes/files.js';
import previewRouter from './routes/preview.js';

const router = Router();

router.use(adminRouter);
router.use(authRouter);
router.use(filesRouter);
router.use(previewRouter);

export default router;
