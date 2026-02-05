# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Management

**JIRA Project:** HexMap
Check the JIRA HexMap project for current tasks, bugs, and feature requests. Testing-related tickets and technical debt are tracked there.

**Quick Links:**
- Testing backlog: See `JIRA-TICKETS.md` for ready-to-paste ticket templates
- Testing documentation: See `TESTING.md`
- Data pipeline: See `DATA-PIPELINE.md`

## Commands

### Development
- `npm start` - Start development server (uses react-scripts)
- `npm run build` - Build for production (outputs to `build/` directory)
- `npm test` - Run unit tests (Jest)
- `npm run dev` - Start development server using Vite

### Testing
- `npm test` - Run all unit tests with Jest
- `npm test -- --watchAll=false` - Run tests once without watch mode
- `run-visual-tests.cmd` - Run Playwright visual/interaction tests (Windows only)
  - Starts dev server, runs browser automation, captures screenshots
  - See `TESTING.md` for full testing guide

### Data Pipeline
- `python tools/servicenow_ingest.py <cmdb_export> [options]` - Ingest ServiceNow CMDB data
- `python tools/continent_layout.py <input.csv>` - Generate continent-based hex layout
- `python tools/convert_to_hexmap.py <input.csv>` - Simple CSV-to-hexmap conversion
- See `DATA-PIPELINE.md` for full documentation

### Deployment
- `build_and_publish.cmd` - Build and deploy to GitHub Pages (Windows batch file)
  - Builds the project
  - Clears the `docs/` folder
  - Copies build output to `docs/`
  - Commits and pushes to GitHub (deployed at https://ganizanisitara.github.io/hexmap)

## Architecture

This is a React-based hexagonal grid visualization application using D3.js for rendering and interactions.

### Core Components

**HexMap.js** - Main application component that orchestrates the entire visualization:
- Manages all state (zoom, selections, hover states, context menus, detail panel)
- Integrates all rendering components and UI panels
- Handles color mode switching (Cluster vs Status)
- Coordinates tooltip management and connection rendering

**HexGrid.js** - Core hexagonal grid mathematics:
- Converts between hex grid coordinates and pixel coordinates
- Generates hexagon paths for D3 rendering
- Handles collision detection for overlapping apps
- Uses odd-r horizontal coordinate system

**HexGridRenderer.js** - Renders the hexagonal grid visualization:
- Creates SVG elements for clusters and individual hexagons
- Handles mouse interactions (hover, click, context menus)
- Left-click on hexagons (zoom >= 2.2) opens the NodeDetailPanel
- Right-click shows context menu with View Details, Open Detail Page, Show Connections
- Manages app positioning using absolute grid coordinates
- Integrates with tooltip system

### Key Classes

**ZoomHandler** - Manages pan/zoom behavior and zoom level transitions
**ClusterManager** - Handles cluster selection and focus animations
**ConnectionRenderer** - Draws connection lines between related apps
**TooltipManager** - Manages tooltip display and positioning

### Data Structure

The application loads data from `src/data.json` with the following structure:
- `clusters[]` - Array of cluster objects with:
  - `id`, `name`, `color` - Cluster identification and styling
  - `gridPosition` - Optional cluster center position `{q, r}`
  - `department`, `leadName`, `leadEmail` - Organizational metadata
  - `budgetStatus`, `priority`, `lastUpdated`, `description` - Status metadata
  - `applications[]` - Array of app objects
- Each app requires:
  - `id`, `name` - App identification
  - `gridPosition` - **Required** absolute hex coordinates `{q, r}`
  - `status` - Numeric value (0-100) for Status color mode
  - `connections[]` - Optional array of `{to, type, strength}` objects for relationships
  - `color` - Optional override color
- Each app can optionally include (used by NodeDetailPanel):
  - `description` - Long description of the application
  - `version` - Version string (e.g. "4.2.1")
  - `owner` - Application owner name
  - `techStack` - Array of technology names (e.g. `["SAP", "Oracle DB", "Java"]`)
  - `uptime` - Uptime percentage (e.g. 99.7)
  - `lastDeployment` - Date string (e.g. "2025-03-01")
  - `detailUrl` - URL to external detail page (opened by "Open Detail Page" button)

### Color Modes

- **Cluster Mode**: Colors hexagons by cluster affiliation
- **Status Mode**: Colors hexagons by status values (red/orange/green scale)

### Coordinate System

Uses absolute positioning where all apps specify exact `gridPosition` coordinates rather than relative cluster positioning. This enables precise spatial relationships and collision detection across the entire map.

The hexagonal grid uses **odd-r horizontal layout** with:
- `q` - Column coordinate (horizontal axis)
- `r` - Row coordinate (vertical axis)
- Odd rows are offset by +0.5 in the x direction
- Grid-to-pixel conversion centered at viewport center (`HexGrid.gridToPixel()`)
- Collision detection tracks all occupied positions globally

### UI Features

- **Zoom levels** - Managed by `ZoomHandler` with smooth transitions
- **Hover states** - Shows app details via `TooltipManager`
- **Node detail panel** - Click on an app (zoom >= 2.2) to open a floating detail modal showing status, uptime, owner, tech stack, connections, and action buttons
- **Context menus** - Right-click on apps for View Details, Open Detail Page, Show Connections
- **Connection visualization** - Animated lines showing app relationships
- **Cluster focus** - Click clusters to highlight and zoom
- **Color mode toggle** - Switch between Cluster and Status coloring

### File Organization

```
src/
  ├── HexMap.js              # Main orchestrator component
  ├── HexGrid.js             # Hex math and coordinate conversion
  ├── HexGrid.test.js        # Unit tests for hex coordinate math
  ├── data.json              # Application data
  ├── components/
  │   ├── HexGridRenderer.js # SVG rendering and interactions
  │   ├── ZoomHandler.js     # Pan/zoom behavior
  │   └── ClusterManager.js  # Cluster selection logic
  ├── ConnectionRenderer.js  # Connection line rendering
  ├── connectionUtils.js     # Connection path generation
  ├── connectionUtils.test.js # Unit tests for connections
  ├── ui/
  │   ├── components.js      # UI panel components
  │   ├── Tooltip.js         # Tooltip component
  │   └── components/
  │       ├── ContextMenu.js      # Right-click context menu
  │       ├── ClusterInfoPanel.js # Cluster metadata panel
  │       └── NodeDetailPanel.js  # App detail modal (click-through)
  └── utils/
      ├── colorUtils.js      # Color calculation for hexagons
      ├── colorUtils.test.js # Unit tests for color logic
      ├── TooltipManager.js  # Tooltip display logic
      └── ZoomUtils.js       # Zoom level utilities

tools/
  ├── servicenow_ingest.py   # ServiceNow CMDB + Confluence ingest pipeline
  ├── continent_layout.py    # Force-directed continent layout engine
  ├── convert_to_hexmap.py   # Simple CSV/Excel to data.json converter
  ├── requirements.txt       # Python dependencies (pandas, openpyxl)
  └── templates/
      ├── enterprise_apps.csv         # Sample enterprise app data
      ├── with_connections.csv        # Simple connection example
      ├── cmdb_sample.csv             # Sample ServiceNow CMDB export
      └── classification_overrides.csv # Business/technical override template

test_hexmap_visual.py        # Playwright browser automation tests
with_server.py               # Helper for managing dev server during tests
TESTING.md                   # Comprehensive testing guide
DATA-PIPELINE.md             # Data pipeline and ingest documentation
```

### Testing

The project has comprehensive test coverage:

**Unit Tests (Jest):**
- `HexGrid.test.js` - 20 tests for coordinate conversions and collision detection
- `colorUtils.test.js` - 16 tests for Status/Cluster color modes
- `connectionUtils.test.js` - 32 tests for connection path generation

**Visual Tests (Playwright):**
- Automated browser testing of all user interactions
- Tests zoom, pan, hover, click behaviors
- Captures 13 screenshots for visual verification
- Run with `run-visual-tests.cmd` on Windows

See `TESTING.md` for complete testing documentation.
