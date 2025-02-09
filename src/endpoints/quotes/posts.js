const readAllPost = (req, res) => {
    const { space } = req.params;

    res.sendStatus(200);
};

const createPost = (req, res) => {
    const { space } = req.params;

    res.sendStatus(200);
};

const readPost = (req, res) => {
    const { space, id } = req.params;

    res.sendStatus(200);
};

const updatePost = (req, res) => {
    const { space, id } = req.params;

    res.sendStatus(200);
};

const deletePost = (req, res) => {
    const { space, id } = req.params;

    res.sendStatus(200);
};

export const postsRouter = router => {
    router.get('/:space/posts', readAllPost);
    router.post('/:space/posts', createPost);
    router.get('/:space/posts/:id', readPost);
    router.put('/:space/posts/:id', updatePost);
    router.delete('/:space/posts/:id', deletePost);
    return router;
};
