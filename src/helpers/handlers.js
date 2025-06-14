export const createSimpleMemoryHandler = () => {
    let memory = [];
    return {
        getMemory: () => memory,
        updateMemory: newMemory => {
            memory = newMemory;
        },
        clearMemory: () => {
            memory = [];
        },
    };
};

export const createIpMemoryHandler = () => {
    let memory = {};
    return ip => {
        memory[ip] ??= [];
        return {
            getMemory: () => memory[ip],
            updateMemory: newMemory => {
                memory[ip] = newMemory;
            },
            clearMemory: () => {
                memory[ip] = [];
            },
        };
    };
};
