export const DEFAULT_COLOR_SCHEME_ID = 'hexmap-default';

// Set REACT_APP_COLOR_SCHEME=moss-tidal to run with Moss Tidal without changing source.
export const ACTIVE_COLOR_SCHEME_ID = process.env.REACT_APP_COLOR_SCHEME || DEFAULT_COLOR_SCHEME_ID;
