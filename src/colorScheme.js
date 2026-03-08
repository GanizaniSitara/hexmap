import { ACTIVE_COLOR_SCHEME_ID, DEFAULT_COLOR_SCHEME_ID } from './colorSchemeConfig';
import { getColorScheme } from './colorSchemes';

const colorScheme = getColorScheme(ACTIVE_COLOR_SCHEME_ID, DEFAULT_COLOR_SCHEME_ID);

export default colorScheme;
