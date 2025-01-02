export const randomPick = arr => arr[Math.floor(Math.random() * arr.length)];
export const randomIndex = arr => Math.floor(Math.random() * arr.length);

export const randomIndexWithMemory = (arr, memoryHandler, repetitionProbability = 0) => {
    if (arr.length === 0) throw new Error('List length cannot be zero');

    if (Math.random() < repetitionProbability) {
        console.log('Puede repetirse');
        return randomIndex(arr);
    }

    console.log('No puede repetirse');
    let memory = memoryHandler.getMemory();
    console.log('Random Memory:', memory);
    if (memory.length >= arr.length) memory = [];

    let index;
    do {
        index = randomIndex(arr);
    } while (memory.includes(index));

    memory.push(index);
    console.log('new local memory:', memory);
    memoryHandler.updateMemory(memory);

    return index;
};
