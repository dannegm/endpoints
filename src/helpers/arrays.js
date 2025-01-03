export const randomPick = arr => arr[Math.floor(Math.random() * arr.length)];
export const randomIndex = arr => Math.floor(Math.random() * arr.length);

export const randomIndexWithMemory = (arr, memoryHandler, repetitionProbability = 0) => {
    if (arr.length === 0) throw new Error('List length cannot be zero');

    if (Math.random() < repetitionProbability) {
        return randomIndex(arr);
    }

    let memory = memoryHandler.getMemory();
    if (memory.length >= arr.length) memory = [];

    let index;
    do {
        index = randomIndex(arr);
    } while (memory.includes(index));

    memory.push(index);
    memoryHandler.updateMemory(memory);

    return index;
};
