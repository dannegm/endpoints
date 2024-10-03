module.exports = function (plop) {
    plop.setGenerator('endpoint', {
        description: 'Create a endpoint structure',
        prompts: [
            {
                type: 'input',
                name: 'name',
                message: 'Endpoint name:',
            },
        ],
        actions: [
            {
                type: 'add',
                path: 'src/endpoints/{{kebabCase name}}/router.js',
                templateFile: 'templates/endpoint/router.js.hbs',
            },
        ],
    });
};
