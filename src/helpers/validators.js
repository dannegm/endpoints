import urlRegexForTest from 'url-regex-safe';

const urlRegex = urlRegexForTest({
    exact: true,
    parens: true,
});

export const urlValidator = url => {
    return urlRegex.test(url);
};
