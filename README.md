# HexMap
Non-geographical map of entities, organized in a hexagonal grid.

Intended to be used for visualizations that require spacial affinity 
and relationships, drawing inspiration from geographical context and 
humans being good at recognizing patterns in maps.

See Live Demo: https://ganizanisitara.github.io/hexmap/

## Project Application Flows

The existing Python graph generator reads weighted application flows from Excel,
discovers communities, and writes the absolute positions consumed by this viewer.
It supports deterministic row packing, isolated applications, an optional PNG,
and comparison with yesterday's layout. See [the flow projection guide](tools/GRAPH-PROJECTION.md).

## Features
- Hexagonal grid
- Zoom levels
- Absolute positioning of entities
- Relationships visualizations of different types and strenghts
- Collision detection (on input)
- Cluster/group details on hover

## Usage
```javascript
npm start
