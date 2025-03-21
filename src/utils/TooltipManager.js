export default class TooltipManager {
    constructor() {
        // Create tooltip element
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'hex-tooltip';
        this.tooltip.style.cssText = `
      position: fixed;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 13px;
      font-family: sans-serif;
      font-weight: 500;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      white-space: nowrap;
      border: 1px solid rgba(255, 255, 255, 0.3);
      opacity: 0;
      transition: opacity 0.15s ease;
      transform: translate(-50%, -120%);
    `;
        document.body.appendChild(this.tooltip);

        // Initialize
        this.currentZoomLevel = 1;
        this.zoomThreshold = 2.2;
    }

    updateZoomLevel(zoomLevel) {
        this.currentZoomLevel = zoomLevel;
        if (zoomLevel < this.zoomThreshold) {
            this.hide();
        }
    }

    show(text, event) {
        if (this.currentZoomLevel >= this.zoomThreshold) {
            this.tooltip.textContent = text;
            this.tooltip.style.left = `${event.clientX}px`;
            this.tooltip.style.top = `${event.clientY}px`;
            this.tooltip.style.opacity = '1';
        }
    }

    hide() {
        this.tooltip.style.opacity = '0';
    }

    cleanup() {
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }
    }
}