export const state = {
    lastRefresh: null,
    lastResult: null,
    REFRESH_INTERVAL: 8 * 60 * 60 * 1000,
};

export const canRefresh = () => {
    if (!state.lastRefresh) return true;
    return Date.now() - new Date(state.lastRefresh).getTime() > state.REFRESH_INTERVAL;
};
