export const createSimpleMemoryHandler = () => {
    const memory = [];
    return {
        getMemory: () => memory,
        updateMemory: newMemory => {
            memory = newMemory;
        },
    };
};

export const createIpMemoryHandler = () => {
    const memory = {};
    return ip => {
        memory[ip] ??= [];
        return {
            getMemory: () => memory[ip],
            updateMemory: newMemory => {
                memory[ip] = newMemory;
            },
        };
    };
};
