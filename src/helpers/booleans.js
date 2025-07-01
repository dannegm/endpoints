export const isFalsy = value => {
    if (
        value === false ||
        value === 0 ||
        value === null ||
        value === undefined ||
        Number.isNaN(value)
    )
        return true;

    if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        return ['false', '0', 'null', 'undefined', 'nan', '', 'no', 'off'].includes(lower);
    }

    return false;
};

export const isTruthy = value => !isFalsy(value);
