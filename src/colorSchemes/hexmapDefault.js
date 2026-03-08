const hexmapDefault = {
    id: 'hexmap-default',
    name: 'HexMap Default',
    description: 'Original HexMap palette from data.json and status defaults.',
    source: 'HexMap src/data.json + src/utils/colorUtils.js',
    clusterColors: {
        finance: '#4169E1',
        hr: '#DC143C',
        sales: '#32CD32',
        it: '#9932CC',
        marketing: '#FF8C00',
        emerging: '#1E90FF',
        crossfunctional: '#008080',
    },
    statusColors: {
        low: '#FF0000',
        medium: '#FFA500',
        high: '#008000',
        undefined: '#808080',
    },
    defaults: {
        empty: '#cccccc',
    },
};

export default hexmapDefault;
