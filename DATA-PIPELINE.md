# Data Pipeline

How to get real application data from ServiceNow CMDB and Confluence into the hex map.

## Overview

```
ServiceNow CMDB export ─┐
                         ├─> servicenow_ingest.py ─> continent_layout.py ─> src/data.json
Confluence pickle files ─┘
```

Three tools, each useful standalone or chained together:

| Tool | Input | Output | Use when |
|------|-------|--------|----------|
| `servicenow_ingest.py` | CMDB CSV/JSON + Confluence pickles | `data.json` | You have ServiceNow data |
| `continent_layout.py` | Simple CSV (name, business, status) | `data.json` | You have a flat app list |
| `convert_to_hexmap.py` | CSV/TSV/Excel | `data.json` | Quick conversion, no smart layout |

## ServiceNow CMDB Ingest

### Quick Start

```bash
cd tools/

# Preview classification without generating a map
python servicenow_ingest.py cmdb_export.csv --preview

# Generate a business application map
python servicenow_ingest.py cmdb_export.csv -o ../src/data.json

# With Confluence enrichment
python servicenow_ingest.py cmdb_export.csv --confluence-dir ../pickles/ -o ../src/data.json

# Technical infrastructure map instead
python servicenow_ingest.py cmdb_export.csv --map-type technical -o ../src/data.json
```

### Input: CMDB Export

Export a CSV from ServiceNow with these columns (all optional except `name`):

| Column | ServiceNow field | Used for |
|--------|-----------------|----------|
| `name` | CI name | App name on the map |
| `sys_class_name` | CI class | Business vs technical classification |
| `category` | Category | Domain assignment |
| `subcategory` | Subcategory | Domain refinement |
| `short_description` | Short description | App description |
| `description` | Description | Extended description |
| `operational_status` | Operational status | Health score (0-100) |
| `owned_by` | Owned by | Owner field in detail panel |
| `department` | Department | Domain assignment + cluster metadata |
| `business_unit` | Business unit | Domain assignment |
| `version` | Version | Version in detail panel |
| `vendor` | Vendor | Tech stack in detail panel |
| `depends_on` | Depends on (semicolon-separated) | Connection lines on map |

The column name matching is flexible. It handles common aliases like `app_name`, `ci_name`, `status`, `assigned_to`, `relates_to`, etc.

JSON exports from the ServiceNow REST API are also supported (including the `{"result": [...]}` wrapper and `{"value": "...", "display_value": "..."}` nested fields).

See `tools/templates/cmdb_sample.csv` for an example with 38 records.

### Business vs Technical Classification

Every app gets classified as **business** or **technical/infrastructure** using three signals:

1. **CI Class** (strongest signal)
   - `cmdb_ci_business_app`, `cmdb_ci_service` -> business
   - `cmdb_ci_server`, `cmdb_ci_database`, `cmdb_ci_kubernetes_cluster` -> technical

2. **Keyword matching** against name + description + category
   - Business: "CRM", "payroll", "recruiting", "compliance", "analytics"
   - Technical: "kubernetes", "database", "firewall", "terraform", "monitoring"

3. **Department / Business Unit** - if set, boosts the business score

Business apps are further assigned to a **domain** (Finance, HR, Sales, Marketing, IT, Customer, Operations, Data & Analytics) using another keyword pass. Each domain becomes a continent on the map.

### Classification Overrides

For edge cases where the heuristics get it wrong, provide a CSV override file:

```csv
app_name,is_business,domain
Snowflake,false,Infrastructure
Data Warehouse,true,Data & Analytics
SAP ERP,true,Finance
Custom Analytics,true,Data & Analytics
```

```bash
python servicenow_ingest.py cmdb_export.csv --classification-map overrides.csv
```

See `tools/templates/classification_overrides.csv` for the template.

### Map Types

| Flag | What gets mapped | Continents are |
|------|-----------------|----------------|
| `--map-type business` (default) | Only business apps | Business domains (Finance, HR, etc.) |
| `--map-type technical` | Only infrastructure | Technology categories |
| `--map-type all` | Everything | Business domains + Infrastructure |

### Confluence Enrichment

If you have Confluence content exported to pickle files, point at the directory:

```bash
python servicenow_ingest.py cmdb_export.csv --confluence-dir ./pickles/
```

Expected pickle format (one or more `.pkl` files):
```python
# List of page dicts
[
    {"title": "Accounting System", "body": "<p>Detailed description...</p>"},
    {"title": "Payroll", "body": "..."},
]

# Or dict keyed by space
{
    "FIN": [{"title": "...", "body": "..."}, ...],
    "HR": [{"title": "...", "body": "..."}, ...],
}
```

Matching is by title: exact match first, then substring match (page title contains app name or vice versa). Matched content extends the app description.

### All Options

```
usage: servicenow_ingest.py [-h] [-f {csv,json}] [-o OUTPUT]
                            [--confluence-dir DIR] [--classification-map FILE]
                            [--map-type {business,technical,all}] [-p] [-s SEED]
                            [--water-gap N] [--connected-gap N]
                            input

  input                   ServiceNow CMDB export (CSV or JSON)
  -f, --format            Input format (auto-detected from extension)
  -o, --output            Output JSON file (default: ../src/data.json)
  --confluence-dir        Directory containing Confluence pickle files
  --classification-map    CSV with manual classification overrides
  --map-type              business | technical | all (default: business)
  -p, --preview           Preview classification, don't generate layout
  -s, --seed              Random seed for layout (default: 42)
  --water-gap             Hex gap between unconnected continents (default: 2)
  --connected-gap         Hex gap between connected continents (default: 1)
```

## Continent Layout Engine

The layout engine (`continent_layout.py`) positions clusters and apps on the hex grid automatically. It works in four phases:

1. **Force-directed centroid positioning** - Repulsion between all continents, attraction between connected ones, produces initial centroid positions
2. **BFS territory growth** - Each continent grows outward from its centroid via breadth-first search, claiming hex cells. Connected continents get smaller gaps between them
3. **App placement** - Apps with cross-domain connections are placed on edges facing their targets. Remaining apps fill interior positions
4. **Output generation** - Produces the `data.json` format with absolute grid coordinates

Can be used directly with a simple CSV:

```bash
python continent_layout.py input.csv -o ../src/data.json
```

Input CSV format:
```csv
app_name,business,status,description,connects_to,show_indicator
Trading Platform,Finance,95,Core trading,Risk Engine;Market Data,true
Risk Engine,Finance,94,Risk calcs,Market Data,true
```

## Simple CSV Converter

For quick one-off conversions without the layout algorithm:

```bash
python convert_to_hexmap.py apps.csv -o ../src/data.json
```

Uses spiral positioning around cluster centers. Works with CSV, TSV, and Excel files. Handles column name aliases automatically.

## Output Format

All three tools produce `src/data.json` consumed by the React app. Key fields per app used by the UI:

| Field | Source | UI usage |
|-------|--------|----------|
| `name` | CMDB name | Tooltip + detail panel header |
| `description` | CMDB short_description or Confluence | Detail panel body |
| `status` | operational_status mapped to 0-100 | Status color mode + detail panel |
| `connections` | depends_on relationships | Connection lines + detail panel list |
| `owner` | owned_by | Detail panel |
| `version` | version | Detail panel header |
| `techStack` | vendor (array) | Detail panel tech badges |
| `detailUrl` | Generated from app ID | "Open Detail Page" button |
| `gridPosition` | Layout algorithm output | Hex position on map |
