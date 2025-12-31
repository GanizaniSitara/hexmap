#!/usr/bin/env python3
"""
Continent-Based HexMap Layout Algorithm

Creates "geographic" enterprise architecture maps where:
- Business functions form continents (contiguous landmasses)
- Connected businesses have adjacent shores
- Unconnected businesses have water gaps between them
- Apps are placed within their continent's territory

Usage:
    python continent_layout.py --generate  # Generate test data + layout
    python continent_layout.py input.csv   # Layout from input file
"""

import argparse
import json
import math
import random
import hashlib
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Optional

# Hex directions for grid operations (pointy-top, odd-r offset)
HEX_DIRECTIONS = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]

# Business functions for test data (universal bank)
BUSINESS_FUNCTIONS = [
    "Trading",
    "Risk Management",
    "Retail Banking",
    "Wealth Management",
    "Cards & Payments",
    "Corporate Banking",
    "Operations",
    "Technology & Infrastructure",
]

# Color palette for continents
CONTINENT_COLORS = [
    "#1f78b4",  # Blue - Trading
    "#e31a1c",  # Red - Risk
    "#33a02c",  # Green - Retail
    "#6a3d9a",  # Purple - Wealth
    "#ff7f00",  # Orange - Cards
    "#a6cee3",  # Light Blue - Corporate
    "#b2df8a",  # Light Green - Ops
    "#fdbf6f",  # Light Orange - Tech
]


@dataclass
class App:
    """Represents an application in the enterprise."""
    id: str
    name: str
    business: str
    connections: List[str] = field(default_factory=list)
    status: int = 100
    description: str = ""
    grid_position: Optional[Tuple[int, int]] = None
    show_position_indicator: bool = False  # Dot marker on hexagon

    # Calculated properties
    external_connection_count: int = 0  # Connections to other businesses


@dataclass
class Continent:
    """Represents a business function's territory."""
    id: str
    name: str
    color: str
    apps: List[App] = field(default_factory=list)

    # Layout properties
    centroid: Tuple[float, float] = (0.0, 0.0)
    territory: Set[Tuple[int, int]] = field(default_factory=set)
    target_size: int = 0

    # Connections to other continents (for force calculation)
    connections: Dict[str, int] = field(default_factory=dict)  # continent_id -> strength


class ContinentLayoutEngine:
    """
    Generates continent-based hex layouts for enterprise architecture.
    """

    def __init__(self,
                 water_gap: int = 2,           # Minimum hexes between unconnected continents
                 connected_gap: int = 1,        # Gap between connected continents (shore)
                 padding_ratio: float = 0.2,    # Extra territory beyond app count
                 force_iterations: int = 100,   # Force-directed iterations
                 seed: int = 42,                # Random seed for reproducibility
                 collision_rate: float = 0.01,  # % of apps to create collisions for (~1 collision)
                 indicator_rate: float = 0.15): # % of apps to show position indicators

        self.water_gap = water_gap
        self.connected_gap = connected_gap
        self.padding_ratio = padding_ratio
        self.force_iterations = force_iterations
        self.seed = seed
        self.collision_rate = collision_rate
        self.indicator_rate = indicator_rate

        self.apps: Dict[str, App] = {}
        self.continents: Dict[str, Continent] = {}
        self.occupied_hexes: Set[Tuple[int, int]] = set()

        random.seed(seed)

    def load_apps(self, apps: List[App]):
        """Load applications and organize by continent."""
        self.apps = {app.id: app for app in apps}

        # Group apps by business function
        business_apps = defaultdict(list)
        for app in apps:
            business_apps[app.business].append(app)

        # Create continents
        for i, (business, apps_list) in enumerate(sorted(business_apps.items())):
            color = CONTINENT_COLORS[i % len(CONTINENT_COLORS)]
            continent = Continent(
                id=f"continent_{i}",
                name=business,
                color=color,
                apps=apps_list,
                target_size=int(len(apps_list) * (1 + self.padding_ratio))
            )
            self.continents[continent.id] = continent

        # Calculate inter-continent connections
        self._calculate_continent_connections()

        # Calculate external connection counts for apps
        self._calculate_app_externality()

    def _calculate_continent_connections(self):
        """Calculate connection strength between continents."""
        # Map app -> continent
        app_to_continent = {}
        for continent in self.continents.values():
            for app in continent.apps:
                app_to_continent[app.id] = continent.id

        # Count cross-continent connections
        for continent in self.continents.values():
            continent.connections = defaultdict(int)

        for app in self.apps.values():
            my_continent = app_to_continent.get(app.id)
            if not my_continent:
                continue

            for target_id in app.connections:
                target_continent = app_to_continent.get(target_id)
                if target_continent and target_continent != my_continent:
                    self.continents[my_continent].connections[target_continent] += 1

    def _calculate_app_externality(self):
        """Calculate how many external connections each app has."""
        app_to_business = {app.id: app.business for app in self.apps.values()}

        for app in self.apps.values():
            external = 0
            for target_id in app.connections:
                target_business = app_to_business.get(target_id)
                if target_business and target_business != app.business:
                    external += 1
            app.external_connection_count = external

    def _hash_position(self, name: str, scale: float = 50.0) -> Tuple[float, float]:
        """Generate deterministic initial position from name hash."""
        h = hashlib.md5(name.encode()).hexdigest()
        x = (int(h[:8], 16) / 0xFFFFFFFF - 0.5) * scale
        y = (int(h[8:16], 16) / 0xFFFFFFFF - 0.5) * scale
        return (x, y)

    def _position_continent_centroids(self):
        """Use force-directed layout to position continent centroids."""
        # Initialize positions from name hash (deterministic)
        positions = {}
        for continent in self.continents.values():
            positions[continent.id] = self._hash_position(continent.name)

        # Force-directed iterations
        for iteration in range(self.force_iterations):
            forces = {cid: [0.0, 0.0] for cid in self.continents}

            continent_list = list(self.continents.values())

            for i, c1 in enumerate(continent_list):
                for j, c2 in enumerate(continent_list):
                    if i >= j:
                        continue

                    p1 = positions[c1.id]
                    p2 = positions[c2.id]

                    dx = p2[0] - p1[0]
                    dy = p2[1] - p1[1]
                    dist = math.sqrt(dx*dx + dy*dy) + 0.1

                    # Normalize direction
                    nx, ny = dx/dist, dy/dist

                    # Connection strength between these continents
                    connection_strength = (
                        c1.connections.get(c2.id, 0) +
                        c2.connections.get(c1.id, 0)
                    )

                    # Calculate desired distance based on territory sizes and connection
                    r1 = math.sqrt(c1.target_size / math.pi) * 2
                    r2 = math.sqrt(c2.target_size / math.pi) * 2

                    if connection_strength > 0:
                        # Connected: should be close (shores touching)
                        ideal_dist = r1 + r2 + self.connected_gap
                        attraction = 0.3 * math.log(1 + connection_strength)
                    else:
                        # Not connected: should have water gap
                        ideal_dist = r1 + r2 + self.water_gap * 3
                        attraction = 0.0

                    # Spring force toward ideal distance
                    spring_force = (dist - ideal_dist) * 0.1

                    # Attraction force for connected continents
                    attract_force = attraction * (dist - ideal_dist) * 0.05

                    # Repulsion to prevent overlap
                    min_dist = r1 + r2 + self.water_gap
                    if dist < min_dist:
                        repulsion = (min_dist - dist) * 0.5
                    else:
                        repulsion = 0

                    # Total force
                    total_force = spring_force + attract_force - repulsion

                    forces[c1.id][0] += nx * total_force
                    forces[c1.id][1] += ny * total_force
                    forces[c2.id][0] -= nx * total_force
                    forces[c2.id][1] -= ny * total_force

            # Apply forces with damping
            damping = 0.8 * (1 - iteration / self.force_iterations)
            for cid in positions:
                positions[cid] = (
                    positions[cid][0] + forces[cid][0] * damping,
                    positions[cid][1] + forces[cid][1] * damping
                )

        # Store final positions
        for continent in self.continents.values():
            continent.centroid = positions[continent.id]

    def _grow_territory(self, continent: Continent) -> Set[Tuple[int, int]]:
        """Grow a continent's territory from its centroid using BFS."""
        # Convert centroid to hex coordinates
        cx, cy = continent.centroid
        start_q, start_r = int(round(cx)), int(round(cy))

        # Find nearest unoccupied hex to start
        start_q, start_r = self._find_nearest_empty(start_q, start_r)

        territory = set()
        frontier = [(start_q, start_r)]
        visited = {(start_q, start_r)}

        while len(territory) < continent.target_size and frontier:
            # Sort frontier by distance to centroid (grow roughly circular)
            frontier.sort(key=lambda h: (h[0]-cx)**2 + (h[1]-cy)**2)

            q, r = frontier.pop(0)

            # Check if this hex is available
            if (q, r) in self.occupied_hexes:
                continue

            # Check water gap from other continents
            if self._too_close_to_others(q, r, continent.id):
                continue

            # Claim this hex
            territory.add((q, r))
            self.occupied_hexes.add((q, r))

            # Add neighbors to frontier
            for dq, dr in HEX_DIRECTIONS:
                nq, nr = q + dq, r + dr
                if (nq, nr) not in visited:
                    visited.add((nq, nr))
                    frontier.append((nq, nr))

        return territory

    def _too_close_to_others(self, q: int, r: int, my_continent_id: str) -> bool:
        """Check if hex is too close to another continent's territory."""
        my_continent = self.continents[my_continent_id]

        for other in self.continents.values():
            if other.id == my_continent_id:
                continue

            if not other.territory:
                continue

            # Determine required gap
            connection_strength = (
                my_continent.connections.get(other.id, 0) +
                other.connections.get(my_continent_id, 0)
            )

            required_gap = self.connected_gap if connection_strength > 0 else self.water_gap

            # Check distance to other's territory
            for oq, or_ in other.territory:
                dist = self._hex_distance(q, r, oq, or_)
                if dist < required_gap:
                    return True

        return False

    def _hex_distance(self, q1: int, r1: int, q2: int, r2: int) -> int:
        """Calculate hex grid distance between two hexes."""
        # Convert to cube coordinates
        x1, z1 = q1, r1
        y1 = -x1 - z1
        x2, z2 = q2, r2
        y2 = -x2 - z2

        return (abs(x1-x2) + abs(y1-y2) + abs(z1-z2)) // 2

    def _find_nearest_empty(self, q: int, r: int) -> Tuple[int, int]:
        """Find nearest unoccupied hex using spiral search."""
        if (q, r) not in self.occupied_hexes:
            return (q, r)

        for radius in range(1, 100):
            for dq in range(-radius, radius + 1):
                for dr in range(-radius, radius + 1):
                    nq, nr = q + dq, r + dr
                    if (nq, nr) not in self.occupied_hexes:
                        return (nq, nr)

        return (q, r)

    def _place_apps_in_territory(self, continent: Continent):
        """Place apps within their continent's territory."""
        if not continent.territory:
            return

        territory_list = list(continent.territory)
        cx, cy = continent.centroid

        # Sort apps: high external connections go to edges
        sorted_apps = sorted(
            continent.apps,
            key=lambda a: a.external_connection_count,
            reverse=True
        )

        # Sort territory hexes by distance from centroid
        # External apps get edge hexes, internal apps get center hexes
        territory_by_distance = sorted(
            territory_list,
            key=lambda h: -((h[0]-cx)**2 + (h[1]-cy)**2)  # Negative = farthest first
        )

        # Also prepare center-first list for internal apps
        territory_center_first = sorted(
            territory_list,
            key=lambda h: (h[0]-cx)**2 + (h[1]-cy)**2
        )

        assigned = set()
        assigned_positions = []  # Track for collision creation

        for app in sorted_apps:
            # Randomly assign position indicator
            if random.random() < self.indicator_rate:
                app.show_position_indicator = True

            # Choose position based on externality
            if app.external_connection_count > 0:
                # External app: prefer edges
                candidates = territory_by_distance
            else:
                # Internal app: prefer center
                candidates = territory_center_first

            # Find first unassigned hex
            for hex_pos in candidates:
                if hex_pos not in assigned:
                    app.grid_position = hex_pos
                    assigned.add(hex_pos)
                    assigned_positions.append(hex_pos)
                    break


    def generate_layout(self) -> Dict:
        """Generate the complete layout."""
        print(f"Generating layout for {len(self.continents)} continents, {len(self.apps)} apps")

        # Phase 1: Position continent centroids
        print("Phase 1: Positioning continent centroids...")
        self._position_continent_centroids()

        # Phase 2: Grow territories (in order of size, largest first)
        print("Phase 2: Growing territories...")
        sorted_continents = sorted(
            self.continents.values(),
            key=lambda c: c.target_size,
            reverse=True
        )

        for continent in sorted_continents:
            continent.territory = self._grow_territory(continent)
            print(f"  {continent.name}: {len(continent.territory)} hexes "
                  f"(target: {continent.target_size})")

        # Phase 3: Place apps within territories
        print("Phase 3: Placing apps...")
        for continent in self.continents.values():
            self._place_apps_in_territory(continent)

        # Phase 3b: Create a single collision for demo purposes (within same cluster)
        if self.collision_rate > 0:
            total_apps = sum(len(c.apps) for c in self.continents.values())
            num_collisions = max(1, int(total_apps * self.collision_rate))
            collisions_created = 0

            # Find clusters with enough apps for internal collision
            for continent in self.continents.values():
                if collisions_created >= num_collisions:
                    break
                apps_with_pos = [a for a in continent.apps if a.grid_position]
                if len(apps_with_pos) >= 3:
                    # Create collision within this cluster
                    apps_with_pos[0].grid_position = apps_with_pos[1].grid_position
                    collisions_created += 1
                    print(f"  Created collision in {continent.name}")

            if collisions_created > 0:
                print(f"  Total: {collisions_created} collision(s)")

        # Phase 4: Build output
        print("Phase 4: Building output...")
        return self._build_output()

    def _build_output(self) -> Dict:
        """Build HexMap-compatible JSON output."""
        clusters = []

        for continent in sorted(self.continents.values(), key=lambda c: c.name):
            # Calculate actual centroid from territory
            if continent.territory:
                avg_q = sum(h[0] for h in continent.territory) / len(continent.territory)
                avg_r = sum(h[1] for h in continent.territory) / len(continent.territory)
            else:
                avg_q, avg_r = continent.centroid

            apps_data = []
            for app in continent.apps:
                if app.grid_position:
                    app_data = {
                        "id": app.id,
                        "name": app.name,
                        "color": continent.color,
                        "status": app.status,
                        "gridPosition": {
                            "q": app.grid_position[0],
                            "r": app.grid_position[1]
                        },
                        "connections": [
                            {"to": target, "type": "link", "strength": "medium"}
                            for target in app.connections
                        ]
                    }
                    if app.description:
                        app_data["description"] = app.description
                    if app.show_position_indicator:
                        app_data["showPositionIndicator"] = True
                    apps_data.append(app_data)

            cluster = {
                "id": continent.id,
                "name": continent.name,
                "color": continent.color,
                "hexCount": len(apps_data),
                "gridPosition": {
                    "q": int(round(avg_q)),
                    "r": int(round(avg_r))
                },
                "priority": "Normal",
                "applications": apps_data
            }
            clusters.append(cluster)

        return {"clusters": clusters}


def generate_test_data(num_apps: int = 200, seed: int = 42) -> List[App]:
    """Generate realistic test data for a universal bank."""
    random.seed(seed)

    # App name prefixes by business function
    app_prefixes = {
        "Trading": ["TRD", "FX", "EQ", "FI", "DERIV", "ALGO", "OMS", "EMS"],
        "Risk Management": ["RISK", "VAR", "CREDIT", "MARKET", "OPS", "STRESS", "LIMIT"],
        "Retail Banking": ["RET", "ACCT", "LOAN", "MORT", "SAVE", "CHECK", "MOBILE"],
        "Wealth Management": ["WM", "PORT", "INVEST", "TRUST", "PLAN", "ADV"],
        "Cards & Payments": ["CARD", "PAY", "AUTH", "FRAUD", "SETTLE", "CLEAR"],
        "Corporate Banking": ["CORP", "LEND", "CASH", "TRADE", "FIN", "TREAS"],
        "Operations": ["OPS", "SETTLE", "RECON", "CONFIRM", "CUSTODY", "CLEAR"],
        "Technology & Infrastructure": ["INFRA", "DATA", "API", "SEC", "CLOUD", "NET"],
    }

    app_suffixes = ["Hub", "Engine", "Platform", "Service", "System", "Gateway",
                    "Manager", "Processor", "Core", "Plus", "Pro", "Central"]

    # Distribute apps across businesses (roughly)
    apps_per_business = {}
    remaining = num_apps
    businesses = list(BUSINESS_FUNCTIONS)

    for i, business in enumerate(businesses):
        if i == len(businesses) - 1:
            apps_per_business[business] = remaining
        else:
            # Vary the distribution a bit
            base = num_apps // len(businesses)
            variance = int(base * 0.5)
            count = base + random.randint(-variance, variance)
            count = max(5, min(count, remaining - (len(businesses) - i - 1) * 5))
            apps_per_business[business] = count
            remaining -= count

    print(f"Apps per business: {apps_per_business}")

    # Generate apps
    apps = []
    app_ids = set()

    for business, count in apps_per_business.items():
        prefixes = app_prefixes[business]

        for i in range(count):
            # Generate unique app name
            while True:
                prefix = random.choice(prefixes)
                suffix = random.choice(app_suffixes)
                num = random.randint(1, 99)
                app_id = f"{prefix}_{suffix}_{num}".replace(" ", "_")
                if app_id not in app_ids:
                    app_ids.add(app_id)
                    break

            app = App(
                id=app_id,
                name=app_id.replace("_", " "),
                business=business,
                status=random.randint(50, 100),
                description=f"{business} application"
            )
            apps.append(app)

    # Generate connections
    # 1. Internal connections (within same business) - more common
    # 2. External connections (cross-business) - less common, but important

    app_by_business = defaultdict(list)
    for app in apps:
        app_by_business[app.business].append(app)

    for app in apps:
        num_internal = random.randint(0, 3)
        num_external = random.randint(0, 2) if random.random() < 0.4 else 0

        # Internal connections
        same_business = [a for a in app_by_business[app.business] if a.id != app.id]
        if same_business:
            for target in random.sample(same_business, min(num_internal, len(same_business))):
                app.connections.append(target.id)

        # External connections
        if num_external > 0:
            other_businesses = [b for b in BUSINESS_FUNCTIONS if b != app.business]
            for _ in range(num_external):
                other_biz = random.choice(other_businesses)
                if app_by_business[other_biz]:
                    target = random.choice(app_by_business[other_biz])
                    app.connections.append(target.id)

    return apps


def load_from_csv(filepath: str) -> List[App]:
    """
    Load applications from a CSV file.

    Expected CSV columns:
        - app_name (required): Unique application identifier
        - business (required): Business function / continent name
        - status (optional): Health score 0-100, default 100
        - description (optional): App description
        - connects_to (optional): Semicolon-separated list of app_names this app connects to

    Example CSV:
        app_name,business,status,description,connects_to
        Trading Platform,Trading,95,Core trading system,Risk Engine;Market Data
        Risk Engine,Risk Management,88,Real-time risk calc,
        Market Data,Trading,100,Market data feed,
    """
    import csv
    from pathlib import Path

    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"CSV file not found: {filepath}")

    apps = []
    app_ids = set()

    # Detect delimiter (comma or tab)
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        sample = f.read(2048)
        if '\t' in sample and sample.count('\t') > sample.count(','):
            delimiter = '\t'
        else:
            delimiter = ','

    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=delimiter)

        # Normalize column names
        if reader.fieldnames:
            fieldnames_map = {}
            for fn in reader.fieldnames:
                normalized = fn.lower().strip().replace(' ', '_').replace('-', '_')
                fieldnames_map[fn] = normalized

        for row_num, row in enumerate(reader, start=2):
            # Normalize keys
            normalized_row = {fieldnames_map.get(k, k.lower()): v for k, v in row.items()}

            # Get app name (required)
            app_name = (normalized_row.get('app_name') or
                       normalized_row.get('app') or
                       normalized_row.get('application') or
                       normalized_row.get('name') or '').strip()

            if not app_name:
                print(f"Warning: Row {row_num} has no app_name, skipping")
                continue

            # Get business/cluster (required)
            business = (normalized_row.get('business') or
                       normalized_row.get('cluster') or
                       normalized_row.get('group') or
                       normalized_row.get('domain') or
                       normalized_row.get('business_function') or '').strip()

            if not business:
                print(f"Warning: Row {row_num} ({app_name}) has no business, skipping")
                continue

            # Generate unique ID
            app_id = app_name.replace(' ', '_')
            if app_id in app_ids:
                print(f"Warning: Duplicate app_name '{app_name}' at row {row_num}, skipping")
                continue
            app_ids.add(app_id)

            # Get optional fields
            status_str = normalized_row.get('status', '100').strip()
            try:
                status = int(float(status_str)) if status_str else 100
                status = max(0, min(100, status))  # Clamp to 0-100
            except ValueError:
                status = 100

            description = (normalized_row.get('description') or
                          normalized_row.get('desc') or '').strip()

            # Parse connections (semicolon or comma separated)
            connects_str = (normalized_row.get('connects_to') or
                           normalized_row.get('connections') or
                           normalized_row.get('dependencies') or '').strip()

            connections = []
            if connects_str:
                for target in connects_str.replace(',', ';').split(';'):
                    target = target.strip().replace(' ', '_')
                    if target:
                        connections.append(target)

            # Parse show_indicator flag
            indicator_str = (normalized_row.get('show_indicator') or
                            normalized_row.get('indicator') or '').strip().lower()
            show_indicator = indicator_str in ('true', '1', 'yes', 'y')

            app = App(
                id=app_id,
                name=app_name,
                business=business,
                status=status,
                description=description,
                connections=connections,
                show_position_indicator=show_indicator
            )
            apps.append(app)

    print(f"Loaded {len(apps)} apps from {filepath}")

    # Summary by business
    business_counts = defaultdict(int)
    for app in apps:
        business_counts[app.business] += 1
    print("Apps per business:")
    for biz, count in sorted(business_counts.items()):
        print(f"  {biz}: {count}")

    return apps


def main():
    parser = argparse.ArgumentParser(
        description='Generate continent-based HexMap layouts',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate synthetic test data
  python continent_layout.py --generate --num-apps 200

  # Load from CSV file
  python continent_layout.py apps.csv

  # Load from CSV with custom parameters
  python continent_layout.py apps.csv --water-gap 3 --seed 123

CSV Format:
  Required columns: app_name, business
  Optional columns: status (0-100), description, connects_to (semicolon-separated)

  Example:
    app_name,business,status,connects_to
    Trading Platform,Trading,95,Risk Engine;Market Data
    Risk Engine,Risk Management,88,
        """
    )
    parser.add_argument('input', nargs='?', help='Input CSV/TSV file')
    parser.add_argument('-g', '--generate', action='store_true',
                        help='Generate synthetic test data')
    parser.add_argument('-n', '--num-apps', type=int, default=200,
                        help='Number of apps for synthetic data (default: 200)')
    parser.add_argument('-o', '--output', default='../src/data.json',
                        help='Output JSON file (default: ../src/data.json)')
    parser.add_argument('-s', '--seed', type=int, default=42,
                        help='Random seed for reproducibility (default: 42)')
    parser.add_argument('--water-gap', type=int, default=2,
                        help='Hex gap between unconnected continents (default: 2)')
    parser.add_argument('--connected-gap', type=int, default=1,
                        help='Hex gap between connected continents (default: 1)')

    args = parser.parse_args()

    # Load apps from CSV or generate synthetic data
    if args.input:
        print(f"Loading apps from: {args.input}")
        apps = load_from_csv(args.input)
    elif args.generate:
        print(f"Generating synthetic test data with {args.num_apps} apps...")
        apps = generate_test_data(args.num_apps, args.seed)
    else:
        parser.print_help()
        print("\nError: Provide an input CSV file or use --generate for synthetic data")
        return

    # Create layout engine
    engine = ContinentLayoutEngine(
        water_gap=args.water_gap,
        connected_gap=args.connected_gap,
        seed=args.seed
    )

    # Load apps and generate layout
    engine.load_apps(apps)
    output = engine.generate_layout()

    # Write output
    from pathlib import Path
    output_path = Path(__file__).parent / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nWritten to: {output_path}")
    print(f"Continents: {len(output['clusters'])}")
    total_apps = sum(len(c['applications']) for c in output['clusters'])
    print(f"Applications: {total_apps}")

    # Print summary
    print("\nContinent summary:")
    for cluster in output['clusters']:
        connections_out = sum(
            len(app.get('connections', []))
            for app in cluster['applications']
        )
        print(f"  {cluster['name']}: {cluster['hexCount']} apps, "
              f"{connections_out} connections")


if __name__ == '__main__':
    main()
