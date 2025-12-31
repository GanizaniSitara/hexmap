# HexMap Data Tools

Tools for generating and managing HexMap enterprise architecture visualizations.

## Overview

HexMap displays enterprise applications as a geographic map where:
- **Continents** = Business functions (Trading, Risk, Operations, etc.)
- **Hexagons** = Individual applications
- **Shores** = Shared services and integration points between businesses
- **Connections** = Data flows and dependencies between apps

## Quick Start

### Generate Synthetic Test Data
```bash
cd tools
.\regen.cmd --num-apps 200
```

### Load From Your Own Data
```bash
cd tools
python continent_layout.py your_apps.csv
```

Then refresh the browser at http://localhost:3000

## Input Format

### CSV Structure

| Column | Required | Description |
|--------|----------|-------------|
| `app_name` | Yes | Unique application name |
| `business` | Yes | Business function (becomes continent) |
| `status` | No | Health score 0-100 (default: 100) |
| `description` | No | Application description |
| `connects_to` | No | Semicolon-separated target app names |

### Column Name Aliases

The tool accepts various column name formats:

| Standard | Also Accepts |
|----------|--------------|
| `app_name` | `app`, `application`, `name` |
| `business` | `cluster`, `group`, `domain`, `business_function` |
| `connects_to` | `connections`, `dependencies` |

### Example CSV

```csv
app_name,business,status,description,connects_to
Trading Platform,Trading,95,Core trading system,Risk Engine;Market Data
Risk Engine,Risk Management,88,Real-time risk calc,Market Data
Market Data,Trading,100,Market data feed,
Payment Gateway,Cards & Payments,99,Payment routing,Settlement;Fraud Detection
```

See `templates/enterprise_apps.csv` for a complete example with ~40 apps.

## Scripts

### `continent_layout.py`

Main layout engine. Generates `src/data.json` from input data.

```bash
# From CSV file
python continent_layout.py apps.csv

# Generate synthetic data
python continent_layout.py --generate --num-apps 200

# With options
python continent_layout.py apps.csv --water-gap 3 --seed 123 --output ../src/data.json
```

**Options:**
- `-g, --generate` - Generate synthetic test data
- `-n, --num-apps N` - Number of apps for synthetic data (default: 200)
- `-o, --output FILE` - Output JSON file (default: ../src/data.json)
- `-s, --seed N` - Random seed for reproducibility (default: 42)
- `--water-gap N` - Hex gap between unconnected continents (default: 2)
- `--connected-gap N` - Hex gap between connected continents (default: 1)

### `iterate.cmd` (Windows)

Full iteration cycle: generates layout and opens browser.

```bash
.\iterate.cmd --num-apps 200
.\iterate.cmd --generate --seed 42
```

### `regen.cmd` (Windows)

Quick regeneration when dev server is already running.

```bash
.\regen.cmd --num-apps 200
.\regen.cmd templates\enterprise_apps.csv
```

## Algorithm

The layout engine uses a **continent-based** approach:

### Phase 1: Position Continents
- Each business function becomes a continent
- Force-directed layout positions continent centroids
- Connected businesses are pulled closer (adjacent shores)
- Unconnected businesses have water gaps

### Phase 2: Grow Territories
- BFS growth from each centroid
- Territories expand until they have enough hexes for all apps
- Growth respects gaps between continents
- Creates contiguous "landmass" shapes

### Phase 3: Place Applications
- Apps with many cross-business connections → edges (shores)
- Apps with internal connections only → interior
- Deterministic placement based on app properties

### Stability

The algorithm is designed for **geographic stability**:
- Same input → same output (deterministic)
- Adding apps doesn't reshuffle the entire map
- Continent positions are hash-seeded from names
- Minor changes create "local" updates, not global reshuffles

## Development Workflow

1. Start the dev server (once):
   ```bash
   npm start
   ```

2. Edit your data source or tweak parameters

3. Regenerate layout:
   ```bash
   cd tools
   .\regen.cmd your_data.csv
   ```

4. Refresh browser (F5) to see changes

5. Repeat 2-4 until satisfied

## File Structure

```
tools/
├── README.md                    # This file
├── continent_layout.py          # Main layout engine
├── iterate.cmd                  # Full iteration script (Windows)
├── regen.cmd                    # Quick regeneration (Windows)
├── iterate.sh                   # Full iteration script (Linux/Mac)
├── requirements.txt             # Python dependencies (none required)
└── templates/
    └── enterprise_apps.csv      # Example input data
```

## Tips

### Getting Good Layouts

1. **Business names matter** - They're hash-seeded, so "Trading" will always be in the same relative position
2. **Connections drive adjacency** - More cross-business connections = continents closer together
3. **Water gap** - Increase `--water-gap` for more separation between unrelated businesses
4. **Seed** - Change `--seed` to try different initial configurations

### Scaling

- **~50 apps**: Small, quick layouts
- **~200 apps**: Good for demos and testing
- **~500 apps**: Typical department-level view
- **~3500 apps**: Full enterprise (will need zoom to navigate)

### Status Colors

In "Status" mode, hexagons are colored by health:
- 🟢 Green: 67-100 (Healthy)
- 🟠 Orange: 34-66 (Warning)
- 🔴 Red: 0-33 (Critical)
