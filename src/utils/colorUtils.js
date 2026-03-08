import colorScheme from '../colorScheme';

export const getClusterColor = (cluster) => {
    if (!cluster) {
        return colorScheme.defaults.empty;
    }

    return colorScheme.clusterColors[cluster.id] || cluster.color || colorScheme.defaults.empty;
};

// Function to determine color based on status score
export const getStatusColor = (status) => {
    if (status === undefined || status === null) {
        return colorScheme.statusColors.undefined;
    }
    if (status < 33) {
        return colorScheme.statusColors.low;
    } else if (status < 66) {
        return colorScheme.statusColors.medium;
    } else {
        return colorScheme.statusColors.high;
    }
};

// Function to determine the fill color of a hexagon based on mode and data
// Expects the datum 'd' to be the 'coord' object bound in HexGridRenderer
export const getHexagonFillColor = (d, colorMode) => {
    if (!d) {
        return colorScheme.defaults.empty;
    }

    if (colorMode === 'Status' && d.app) {
        return getStatusColor(d.app.status);
    }

    if (d.cluster) {
        return getClusterColor(d.cluster);
    }

    return colorScheme.defaults.empty;
};
