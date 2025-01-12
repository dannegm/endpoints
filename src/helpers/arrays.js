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

export const pickFromIndex = (arr, index) => {
    if (Number.isNaN(index)) {
        return randomPick(arr);
    }

    if (arr[index] === undefined) {
        return randomPick(arr);
    }

    return arr[index];
};

export const repeatedInsights = arr => {
    const elementCount = {};
    let mostRepeated = null;
    let maxRepetitions = 0;

    arr.forEach(element => {
        elementCount[element] = (elementCount[element] || 0) + 1;
        if (elementCount[element] > maxRepetitions) {
            maxRepetitions = elementCount[element];
            mostRepeated = element;
        }
    });

    const repeatedItems = Object.entries(elementCount)
        .filter(([_, count]) => count > 1)
        .map(([element, repeatedTimes]) => ({ element, repeatedTimes }));

    return {
        repetitionRate: repeatedItems.length ? repeatedItems.length / arr.length : 0,
        count: arr.length,
        repeatedItems,
        mostRepeated,
    };
};
