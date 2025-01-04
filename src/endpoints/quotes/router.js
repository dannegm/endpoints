import { Router } from 'express';

const router = Router();

router.all('/', (req, res) => {
    return res.send('OK - quotes');
});

router.get('/quotes/:space', (req, res) => {
    return res.send('OK - quotes');
});

router.get('/quotes/:space/random', (req, res) => {
    return res.send('OK - quotes');
});

router.get('/quotes/:space/pick', (req, res) => {
    return res.send('OK - quotes');
});

router.get('/quotes/:space/:id', (req, res) => {
    return res.send('OK - quotes');
});

router.post('/quotes/:space', (req, res) => {
    return res.send('OK - quotes');
});

router.post('/quotes/:space/bulk', (req, res) => {
    return res.send('OK - quotes');
});

router.update('/quotes/:space/:id', (req, res) => {
    return res.send('OK - quotes');
});

router.delete('/quotes/:space/:id', (req, res) => {
    return res.send('OK - quotes');
});

export default router;
