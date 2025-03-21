import * as d3 from 'd3';

class ClusterManager {
    constructor({
                    entityData,
                    svg,
                    zoomRef,
                    setSelectedCluster
                }) {
        this.entityData = entityData;
        this.svg = svg;
        this.zoomRef = zoomRef;
        this.setSelectedCluster = setSelectedCluster;

        // Constants
        this.width = window.innerWidth;
        this.height = window.innerHeight;
    }

    selectCluster(cluster) {
        this.setSelectedCluster(cluster);
        const clusterElement = document.getElementById(`cluster-${cluster.id}`);
        if (clusterElement) {
            const bounds = clusterElement.getBBox();
            const x = bounds.x + bounds.width / 2;
            const y = bounds.y + bounds.height / 2;
            const scale = 2.2;
            const translate = [this.width / 2 - scale * x, this.height / 2 - scale * y];
            this.svg.transition()
                .duration(1000)
                .ease(d3.easeCubicInOut)
                .call(this.zoomRef.current.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
        }
    }

    clearSelection() {
        this.setSelectedCluster(null);
        this.svg.transition()
            .duration(1000)
            .ease(d3.easeCubicOut)
            .call(this.zoomRef.current.transform, d3.zoomIdentity.scale(1));
    }

    getClusterApps(clusterId) {
        const cluster = this.entityData.clusters.find(c => c.id === clusterId);
        return cluster ? cluster.applications : [];
    }

    getClusterById(clusterId) {
        return this.entityData.clusters.find(c => c.id === clusterId);
    }

    getAppById(appId) {
        let foundApp = null;
        this.entityData.clusters.forEach(cluster => {
            const app = cluster.applications.find(a => a.id === appId);
            if (app) {
                foundApp = {
                    ...app,
                    clusterName: cluster.name,
                    clusterColor: cluster.color,
                    clusterId: cluster.id
                };
            }
        });
        return foundApp;
    }

    getConnectedApps(appId) {
        const sourceApp = this.getAppById(appId);
        if (!sourceApp || !sourceApp.connections) return [];

        return sourceApp.connections.map(conn => {
            const targetApp = this.getAppById(conn.to);
            return {
                source: sourceApp,
                target: targetApp,
                type: conn.type,
                strength: conn.strength
            };
        }).filter(conn => conn.target !== null);
    }
}

export default ClusterManager;