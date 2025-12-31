#!/usr/bin/env python3
"""
HexMap Data Converter

Converts CSV, TSV, or Excel files to HexMap's data.json format.

Usage:
    python convert_to_hexmap.py input.csv
    python convert_to_hexmap.py input.xlsx --output ../src/data.json
    python convert_to_hexmap.py input.tsv --preview

See README.md for input format documentation.
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path
from collections import defaultdict

# Optional dependencies - check at runtime
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

# Default cluster colors (visually distinct)
DEFAULT_COLORS = [
    "#1f78b4",  # Blue
    "#6a3d9a",  # Purple
    "#33a02c",  # Green
    "#e31a1c",  # Red
    "#ff7f00",  # Orange
    "#a6cee3",  # Light Blue
    "#b2df8a",  # Light Green
    "#fb9a99",  # Light Red
    "#fdbf6f",  # Light Orange
    "#cab2d6",  # Light Purple
]

# Hex grid directions for spiral placement
HEX_DIRECTIONS = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]


def check_dependencies():
    """Check if required dependencies are installed."""
    if not HAS_PANDAS:
        print("Error: pandas is required. Install with:")
        print("  pip install pandas openpyxl")
        sys.exit(1)


def read_input_file(filepath):
    """Read CSV, TSV, or Excel file into a pandas DataFrame."""
    filepath = Path(filepath)

    if not filepath.exists():
        print(f"Error: File not found: {filepath}")
        sys.exit(1)

    suffix = filepath.suffix.lower()

    try:
        if suffix == '.csv':
            df = pd.read_csv(filepath)
        elif suffix == '.tsv':
            df = pd.read_csv(filepath, sep='\t')
        elif suffix in ['.xlsx', '.xls']:
            df = pd.read_excel(filepath)
        else:
            print(f"Error: Unsupported file type: {suffix}")
            print("Supported: .csv, .tsv, .xlsx, .xls")
            sys.exit(1)
    except Exception as e:
        print(f"Error reading file: {e}")
        sys.exit(1)

    return df


def normalize_columns(df):
    """Normalize column names to expected format."""
    # Map common variations to standard names
    column_map = {
        # App name variations
        'app_name': 'app_name',
        'app': 'app_name',
        'application': 'app_name',
        'name': 'app_name',
        'application_name': 'app_name',

        # Cluster variations
        'cluster': 'cluster',
        'group': 'cluster',
        'cluster_name': 'cluster',
        'group_name': 'cluster',
        'category': 'cluster',

        # Status variations
        'status': 'status',
        'health': 'status',
        'score': 'status',
        'health_score': 'status',

        # Description variations
        'description': 'description',
        'desc': 'description',
        'details': 'description',

        # Connection variations
        'connects_to': 'connects_to',
        'connections': 'connects_to',
        'linked_to': 'connects_to',
        'dependencies': 'connects_to',
    }

    # Lowercase all column names first
    df.columns = df.columns.str.lower().str.strip()

    # Apply mapping
    new_columns = {}
    for col in df.columns:
        normalized = col.replace(' ', '_').replace('-', '_')
        if normalized in column_map:
            new_columns[col] = column_map[normalized]
        else:
            new_columns[col] = normalized

    df = df.rename(columns=new_columns)
    return df


def validate_data(df):
    """Validate the input data has required columns."""
    required = ['app_name', 'cluster']
    missing = [col for col in required if col not in df.columns]

    if missing:
        print(f"Error: Missing required columns: {missing}")
        print(f"Found columns: {list(df.columns)}")
        print("\nRequired columns:")
        print("  - app_name (or: app, application, name)")
        print("  - cluster (or: group, category)")
        print("\nOptional columns:")
        print("  - status (0-100, default: 100)")
        print("  - description")
        print("  - connects_to (semicolon-separated app names)")
        sys.exit(1)

    # Check for empty app names
    if df['app_name'].isna().any() or (df['app_name'] == '').any():
        print("Warning: Some rows have empty app_name, they will be skipped")
        df = df[df['app_name'].notna() & (df['app_name'] != '')]

    return df


def generate_spiral_positions(count, center_q=0, center_r=0):
    """Generate hex grid positions in a spiral pattern."""
    positions = [(center_q, center_r)]

    if count <= 1:
        return positions[:count]

    q, r = center_q, center_r
    ring = 1

    while len(positions) < count:
        # Move to start of ring (one step in direction 4, then direction 5)
        q += HEX_DIRECTIONS[4][0]
        r += HEX_DIRECTIONS[4][1]

        # Walk around the ring
        for direction in range(6):
            for _ in range(ring):
                if len(positions) >= count:
                    return positions
                positions.append((q, r))
                q += HEX_DIRECTIONS[direction][0]
                r += HEX_DIRECTIONS[direction][1]

        ring += 1

    return positions[:count]


def calculate_cluster_centers(cluster_names, spacing=15):
    """Calculate center positions for each cluster to avoid overlap."""
    centers = {}
    count = len(cluster_names)

    if count == 1:
        centers[cluster_names[0]] = (0, 0)
        return centers

    # Arrange clusters in a larger spiral
    cluster_positions = generate_spiral_positions(count, 0, 0)

    for i, name in enumerate(sorted(cluster_names)):
        base_q, base_r = cluster_positions[i]
        centers[name] = (base_q * spacing, base_r * spacing)

    return centers


def parse_connections(connects_str):
    """Parse connection string into list of connection objects."""
    if pd.isna(connects_str) or connects_str == '':
        return []

    connections = []
    # Split by semicolon or comma
    targets = [t.strip() for t in str(connects_str).replace(',', ';').split(';')]

    for target in targets:
        if target:
            connections.append({
                "to": target,
                "type": "link",
                "strength": "medium"
            })

    return connections


def convert_to_hexmap_format(df):
    """Convert DataFrame to HexMap JSON structure."""
    # Group by cluster
    clusters_data = defaultdict(list)

    for _, row in df.iterrows():
        app_name = str(row['app_name']).strip()
        cluster_name = str(row['cluster']).strip()

        if not app_name or not cluster_name:
            continue

        app = {
            "id": app_name,
            "name": app_name,
            "status": int(row.get('status', 100)) if pd.notna(row.get('status')) else 100,
            "connections": [],
            "gridPosition": None  # Will be set later
        }

        # Add optional description
        if 'description' in row and pd.notna(row['description']):
            app["description"] = str(row['description'])

        # Add connections
        if 'connects_to' in row:
            app["connections"] = parse_connections(row['connects_to'])

        clusters_data[cluster_name].append(app)

    # Calculate cluster centers
    cluster_names = list(clusters_data.keys())
    cluster_centers = calculate_cluster_centers(cluster_names)

    # Build final structure
    clusters = []

    for i, (cluster_name, apps) in enumerate(sorted(clusters_data.items())):
        color = DEFAULT_COLORS[i % len(DEFAULT_COLORS)]
        center_q, center_r = cluster_centers[cluster_name]

        # Generate positions for apps in this cluster
        positions = generate_spiral_positions(len(apps), center_q, center_r)

        # Assign positions and colors to apps
        for j, app in enumerate(apps):
            q, r = positions[j]
            app["gridPosition"] = {"q": q, "r": r}
            app["color"] = color

        cluster = {
            "id": f"cluster_{i + 1}",
            "name": cluster_name,
            "color": color,
            "hexCount": len(apps),
            "gridPosition": {"q": center_q, "r": center_r},
            "priority": "Normal",
            "applications": apps
        }

        clusters.append(cluster)

    return {"clusters": clusters}


def preview_output(data):
    """Print a preview of the output data."""
    print("\n" + "=" * 60)
    print("PREVIEW")
    print("=" * 60)

    for cluster in data["clusters"]:
        print(f"\nCluster: {cluster['name']} ({len(cluster['applications'])} apps)")
        print(f"  Color: {cluster['color']}")
        print(f"  Center: q={cluster['gridPosition']['q']}, r={cluster['gridPosition']['r']}")
        print("  Applications:")
        for app in cluster['applications'][:5]:  # Show first 5
            pos = app['gridPosition']
            conn_count = len(app.get('connections', []))
            print(f"    - {app['name']} (status: {app.get('status', 'N/A')}, "
                  f"pos: {pos['q']},{pos['r']}, connections: {conn_count})")
        if len(cluster['applications']) > 5:
            print(f"    ... and {len(cluster['applications']) - 5} more")

    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Convert CSV/TSV/Excel to HexMap data.json format',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python convert_to_hexmap.py apps.csv
  python convert_to_hexmap.py apps.xlsx --output ../src/data.json
  python convert_to_hexmap.py apps.tsv --preview

Input file format:
  Required columns: app_name, cluster
  Optional columns: status (0-100), description, connects_to (semicolon-separated)
        """
    )

    parser.add_argument('input', help='Input file (CSV, TSV, or Excel)')
    parser.add_argument('-o', '--output',
                        default='../src/data.json',
                        help='Output JSON file (default: ../src/data.json)')
    parser.add_argument('-p', '--preview',
                        action='store_true',
                        help='Preview output without writing file')
    parser.add_argument('-v', '--verbose',
                        action='store_true',
                        help='Verbose output')

    args = parser.parse_args()

    # Check dependencies
    check_dependencies()

    # Read input
    if args.verbose:
        print(f"Reading: {args.input}")

    df = read_input_file(args.input)

    if args.verbose:
        print(f"Found {len(df)} rows")

    # Normalize and validate
    df = normalize_columns(df)
    df = validate_data(df)

    if args.verbose:
        print(f"Columns: {list(df.columns)}")
        print(f"Clusters: {df['cluster'].nunique()}")

    # Convert
    data = convert_to_hexmap_format(df)

    # Preview or write
    if args.preview:
        preview_output(data)
        print(json.dumps(data, indent=2)[:2000] + "\n...")
    else:
        # Resolve output path relative to script location
        script_dir = Path(__file__).parent
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = script_dir / output_path

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Write output
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"Written: {output_path}")
        print(f"  Clusters: {len(data['clusters'])}")
        total_apps = sum(len(c['applications']) for c in data['clusters'])
        print(f"  Applications: {total_apps}")


if __name__ == '__main__':
    main()
