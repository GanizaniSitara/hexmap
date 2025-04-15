// Function to determine color based on status score
export const getStatusColor = (status) => {
    if (status === undefined || status === null) {
        return '#808080'; // Grey for undefined/null status
    }
    if (status < 33) {
        return '#FF0000'; // Red for low status (0-32)
    } else if (status < 66) {
        return '#FFA500'; // Amber for medium status (33-65)
    } else {
        return '#008000'; // Green for high status (66-100)
    }
};

// Function to determine the fill color of a hexagon based on mode and data
// Expects the datum 'd' to be the 'coord' object bound in HexGridRenderer
export const getHexagonFillColor = (d, colorMode) => {
    if (!d) {
        return '#cccccc'; // Default grey if data is missing
    }
    
    const result = (colorMode === 'Status' && d.app) 
        ? getStatusColor(d.app.status)
        : d.cluster 
            ? d.cluster.color 
            : '#cccccc';
    
    return result;
};
