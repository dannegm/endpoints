export const createSimpleMemoryHandler = () => {
    let memory = [];

    return {
        getMemory: () => {
            return memory;
        },
        updateMemory: newMemory => {
            memory = newMemory;
        },
    };
};
