import hexmapDefault from './hexmapDefault';
import mossTidal from './mossTidal';

export const colorSchemes = {
    [hexmapDefault.id]: hexmapDefault,
    [mossTidal.id]: mossTidal,
};

export const getColorScheme = (schemeId, fallbackId = hexmapDefault.id) =>
    colorSchemes[schemeId] || colorSchemes[fallbackId] || hexmapDefault;
