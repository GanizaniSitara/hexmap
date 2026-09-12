import argparse
import colorsys
import hashlib
import json
import math
import os
from collections import defaultdict, deque
from pathlib import Path
import tempfile

import networkx as nx
import numpy as np


DEFAULT_JSON_OUT = Path(__file__).resolve().parent.parent / "src" / "data.json"
DEFAULT_PNG_OUT = Path("graph_layout_final.png")
MAX_PER_ROW = 10
RAG_PALETTE = ["#e31a1c", "#ff7f00", "#33a02c"]
CLUSTER_BASE_PALETTE = ["#1f78b4", "#6a3d9a", "#a6cee3", "#cab2d6", "#507ea4", "#9173aa", "#72a4bd"]
SQRT3 = math.sqrt(3)
DIRS = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]
CLUSTER_GAP = 2
BUFFER_CELLS = [(column, row) for column in range(-CLUSTER_GAP, CLUSTER_GAP + 1)
                for row in range(-CLUSTER_GAP, CLUSTER_GAP + 1)
                if max(abs(column), abs(row), abs(column + row)) <= CLUSTER_GAP]


def cube_round(cube_x, cube_y, cube_z):
    rounded_x, rounded_y, rounded_z = round(cube_x), round(cube_y), round(cube_z)
    differences = abs(rounded_x - cube_x), abs(rounded_y - cube_y), abs(rounded_z - cube_z)
    if differences[0] > differences[1] and differences[0] > differences[2]:
        rounded_x = -rounded_y - rounded_z
    elif differences[1] > differences[2]:
        rounded_y = -rounded_x - rounded_z
    else:
        rounded_z = -rounded_x - rounded_y
    return rounded_x, rounded_y, rounded_z


def cartesian_to_axial(cartesian_x, cartesian_y, hex_pixel_size=1.0):
    positive_number(hex_pixel_size)
    axial_column = (SQRT3 / 3 * cartesian_x - cartesian_y / 3) / hex_pixel_size
    axial_row = (2 / 3 * cartesian_y) / hex_pixel_size
    rounded_column, _, rounded_row = cube_round(axial_column, -axial_column - axial_row, axial_row)
    return rounded_column, rounded_row


def axial_to_cartesian(column, row):
    return SQRT3 * (column + row / 2), 1.5 * row


def axial_to_offset(column, row):
    return column + (row - (row & 1)) // 2, row


def offset_to_axial(column, row):
    return column - (row - (row & 1)) // 2, row


def positive_number(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise ValueError("Expected a finite positive number")
    return number


def normalize_identifier(value):
    if value is None or isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Application identifiers must not be missing")
    identifier = str(value).strip()
    if not identifier:
        raise ValueError("Application identifiers must not be empty")
    return identifier


def load_edges_from_excel(path, sheet, sc="Source Application", tc="Target Application", wc="Duplication Count"):
    import pandas as pd

    frame = pd.read_excel(path, sheet_name=sheet)
    missing = [column for column in (sc, tc, wc) if column not in frame.columns]
    if missing:
        raise ValueError(f"Missing Excel columns: {', '.join(missing)}")
    if frame[[sc, tc, wc]].isna().any().any():
        raise ValueError("Excel contains missing application identifiers or weights")
    return list(frame[[sc, tc, wc]].itertuples(index=False, name=None))


def load_edges_from_sample():
    try:
        from sample_data import sample_edges
        return sample_edges
    except ModuleNotFoundError as error:
        if error.name != "sample_data":
            raise
    return [("AppA", "AppB", 10.0), ("AppB", "AppC", 20.0), ("AppA", "AppC", 5.0),
            ("AppD", "AppE", 15.0), ("AppE", "AppF", 25.0), ("AppD", "AppF", 8.0),
            ("AppG", "AppH", 12.0), ("AppA", "AppD", 30.0), ("AppB", "AppE", 20.0),
            ("AppX", "AppY", 50.0), ("AppY", "AppZ", 60.0), ("AppX", "AppZ", 40.0),
            ("AppA", "AppX", 70.0),
            *[(f"C1N{index}", f"C1N{index + 1}", 5.0) for index in range(12)],
            *[(f"C2N{index}", f"C2N{index + 1}", 5.0) for index in range(8)],
            ("AppC", "C1N0", 15.0), ("AppF", "C2N0", 15.0), ("C1N6", "C2N4", 25.0)]


def build_graph(edges, nodes=()):
    weights = defaultdict(list)
    identifiers = {normalize_identifier(node) for node in nodes}
    for source, target, weight in edges:
        source, target = normalize_identifier(source), normalize_identifier(target)
        weights[source, target].append(positive_number(weight))
        identifiers.update((source, target))
    graph = nx.DiGraph()
    graph.add_nodes_from(sorted(identifiers))
    for (source, target), values in sorted(weights.items()):
        graph.add_edge(source, target, weight=positive_number(math.fsum(sorted(values))))
    return graph


def build_affinity_graph(graph):
    weights = defaultdict(list)
    for source, target, attributes in graph.edges(data=True):
        if source != target:
            weights[tuple(sorted((source, target)))].append(attributes["weight"])
    affinity = nx.Graph()
    affinity.add_nodes_from(sorted(graph.nodes()))
    for (source, target), values in sorted(weights.items()):
        affinity.add_edge(source, target, weight=positive_number(math.fsum(sorted(values))))
    return affinity


def build_metagraph(graph, clusters):
    membership = {node: index for index, cluster in enumerate(clusters) for node in cluster}
    weights = defaultdict(list)
    for source, target, attributes in graph.edges(data=True):
        source_cluster, target_cluster = membership[source], membership[target]
        if source_cluster != target_cluster:
            weights[tuple(sorted((source_cluster, target_cluster)))].append(attributes["weight"])
    metagraph = nx.Graph()
    metagraph.add_nodes_from(range(len(clusters)))
    for (source, target), values in sorted(weights.items()):
        weight = positive_number(math.fsum(sorted(values)))
        distance = positive_number(1.0 / weight)
        metagraph.add_edge(source, target, weight=weight, distance=distance)
    return metagraph


def ordered_subgraph(graph, nodes):
    subgraph = graph.__class__()
    subgraph.add_nodes_from(sorted(nodes))
    edges = []
    for source, target, attributes in graph.subgraph(nodes).edges(data=True):
        if not graph.is_directed():
            source, target = sorted((source, target))
        edges.append((source, target, attributes))
    subgraph.add_edges_from(sorted(edges, key=lambda edge: (edge[0], edge[1])))
    return subgraph


def layout_centers(metagraph, scale, initial=None):
    if not metagraph:
        return {}
    components = sorted((sorted(component) for component in nx.connected_components(metagraph)))
    if len(components) == 1:
        if len(metagraph) == 1:
            return {components[0][0]: (0.0, 0.0)}
        positions = nx.circular_layout(metagraph)
        positions.update(initial or {})
        return nx.kamada_kawai_layout(metagraph, weight="distance", pos=positions, scale=scale)
    islands = []
    for component in components:
        local = layout_centers(ordered_subgraph(metagraph, component), scale)
        minimum_x = min(position[0] for position in local.values())
        minimum_y = min(position[1] for position in local.values())
        width = max(position[0] for position in local.values()) - minimum_x + 6
        height = max(position[1] for position in local.values()) - minimum_y + 6
        islands.append((local, minimum_x, minimum_y, width, height))
    target_width = max(max(island[3] for island in islands), math.sqrt(sum(island[3] * island[4] for island in islands)))
    cursor_x, cursor_y, row_height = 0.0, 0.0, 0.0
    centers = {}
    for local, minimum_x, minimum_y, width, height in islands:
        if cursor_x and cursor_x + width > target_width:
            cursor_x, cursor_y, row_height = 0.0, cursor_y + row_height, 0.0
        for node, position in local.items():
            centers[node] = (position[0] - minimum_x + cursor_x, position[1] - minimum_y + cursor_y)
        cursor_x += width
        row_height = max(row_height, height)
    mean_x = sum(position[0] for position in centers.values()) / len(centers)
    mean_y = sum(position[1] for position in centers.values()) / len(centers)
    return {node: (position[0] - mean_x, position[1] - mean_y) for node, position in centers.items()}


def hierarchical_layout(graph, internal_k=0.05, meta_kk_scale=10.0, seed=42, compute_internal=True,
                        previous=None, signature=None):
    positive_number(internal_k)
    positive_number(meta_kk_scale)
    affinity = build_affinity_graph(graph)
    communities = []
    for component in sorted((sorted(nodes) for nodes in nx.connected_components(affinity))):
        subgraph = ordered_subgraph(affinity, component)
        if len(component) == 1:
            communities.append(component)
        else:
            communities.extend(nx.algorithms.community.louvain_communities(subgraph, weight="weight", seed=seed))
    clusters = [sorted(community, key=lambda node: (-graph.degree(node), node)) for community in communities]
    clusters.sort(key=lambda cluster: (-len(cluster), tuple(sorted(cluster))))
    metagraph = build_metagraph(graph, clusters)
    previous_metadata = (previous or {}).get("projection", {})
    previous_centers = previous_metadata.get("centers", {})
    prior_by_members = {frozenset(app["id"] for app in cluster["applications"]): previous_centers.get(cluster["id"])
                        for cluster in (previous or {}).get("clusters", [])}
    initial = {index: prior_by_members[frozenset(cluster)] for index, cluster in enumerate(clusters)
               if prior_by_members.get(frozenset(cluster)) is not None}
    if signature and previous_metadata.get("signature") == signature and len(initial) == len(clusters):
        centers = initial
    else:
        footprint_scale = max(1.0, math.sqrt(len(graph)) / MAX_PER_ROW)
        centers = layout_centers(metagraph, meta_kk_scale * footprint_scale, initial)
    positions = {}
    if compute_internal:
        random = np.random.default_rng(seed)
        for index, nodes in enumerate(clusters):
            subgraph = ordered_subgraph(graph, nodes)
            if len(nodes) > 1:
                local = nx.spring_layout(subgraph, weight="weight", seed=int(random.integers(0, 1000000)),
                                         k=internal_k, scale=0.3)
            else:
                local = {nodes[0]: (0.0, 0.0)}
            center_x, center_y = centers[index]
            positions.update({node: (center_x + position[0], center_y + position[1]) for node, position in local.items()})
    return positions, clusters, centers


def pack_rows(cluster_anchor_qr, nodes_in_cluster):
    anchor_column, anchor_row = cluster_anchor_qr
    return {node: (anchor_column + index % MAX_PER_ROW - index // MAX_PER_ROW, anchor_row + index // MAX_PER_ROW)
            for index, node in enumerate(nodes_in_cluster)}


def place_clusters_on_hex_grid(cluster_node_lists, meta_cartesian_centers, max_search_attempts=50000):
    occupied = set()
    placements = {}
    order = sorted(range(len(cluster_node_lists)), key=lambda index: (-len(cluster_node_lists[index]), index))
    for index in order:
        nodes = cluster_node_lists[index]
        if not nodes:
            raise ValueError("Cannot place an empty cluster")
        local_cells = list(pack_rows((0, 0), nodes).values())
        local_pixels = [axial_to_cartesian(*cell) for cell in local_cells]
        center_x, center_y = meta_cartesian_centers[index]
        ideal = cartesian_to_axial(center_x - sum(point[0] for point in local_pixels) / len(nodes),
                                   center_y - sum(point[1] for point in local_pixels) / len(nodes))
        frontier, visited = deque([ideal]), {ideal}
        anchor = None
        for _ in range(max_search_attempts):
            if not frontier:
                break
            candidate_column, candidate_row = frontier.popleft()
            if all((candidate_column + column, candidate_row + row) not in occupied for column, row in local_cells):
                anchor = candidate_column, candidate_row
                break
            for delta_column, delta_row in DIRS:
                neighbor = candidate_column + delta_column, candidate_row + delta_row
                if neighbor not in visited:
                    visited.add(neighbor)
                    frontier.append(neighbor)
        if anchor is None:
            raise ValueError(f"Could not place cluster {index + 1} without collisions after {max_search_attempts} attempts")
        positions = pack_rows(anchor, nodes)
        placements[index] = {"anchor": anchor, "app_positions": positions, "cluster_nodes": nodes}
        for column, row in positions.values():
            occupied.update((column + delta_column, row + delta_row) for delta_column, delta_row in BUFFER_CELLS)
    return placements


def extend_palette(count):
    palette = CLUSTER_BASE_PALETTE[:count]
    for index in range(len(palette), count):
        hue = (200 + 80 * ((index * 0.61803398875) % 1)) / 360
        red, green, blue = colorsys.hls_to_rgb(hue, 0.42 + 0.16 * (index % 3), 0.48)
        palette.append(f"#{round(red * 255):02x}{round(green * 255):02x}{round(blue * 255):02x}")
    return palette


def strength_category(weight):
    return "high" if weight >= 500 else "medium" if weight >= 250 else "low"


def calculate_cluster_label_anchor(positions):
    top_row = min(position[1] for position in positions.values())
    top_cells = sorted(position for position in positions.values() if position[1] == top_row)
    return top_cells[len(top_cells) // 2]


def build_json(graph, cluster_node_lists, final_placements, indicator_threshold):
    if indicator_threshold < 0:
        raise ValueError("Indicator threshold must be nonnegative")
    palette = extend_palette(len(cluster_node_lists))
    data = {"clusters": []}
    for index, nodes in enumerate(cluster_node_lists):
        positions = final_placements[index]["app_positions"]
        label_column, label_row = axial_to_offset(*calculate_cluster_label_anchor(positions))
        applications = []
        for node in nodes:
            column, row = axial_to_offset(*positions[node])
            application = {"id": node, "name": node, "color": palette[index], "status": 100,
                           "gridPosition": {"q": column, "r": row},
                           "connections": [{"to": target, "type": "link", "strength": strength_category(graph[node][target]["weight"])}
                                           for target in sorted(graph.successors(node))]}
            if graph.out_degree(node) > indicator_threshold:
                application["showPositionIndicator"] = True
            applications.append(application)
        data["clusters"].append({"id": f"cluster_{index + 1}", "name": f"APPS {index + 1}",
                                 "color": palette[index], "hexCount": len(nodes), "priority": "Normal",
                                 "gridPosition": {"q": label_column, "r": label_row}, "applications": applications})
    validate_json(data, set(graph.nodes()))
    return data


def validate_json(data, expected_nodes=None):
    identifiers, occupied, cluster_ids = set(), set(), set()
    for cluster in data["clusters"]:
        if cluster["id"] in cluster_ids or cluster["hexCount"] != len(cluster["applications"]):
            raise ValueError("Invalid cluster IDs or hex counts")
        cluster_ids.add(cluster["id"])
        for application in cluster["applications"]:
            identifier = application["id"]
            position = application["gridPosition"]["q"], application["gridPosition"]["r"]
            if not isinstance(identifier, str) or not identifier or identifier in identifiers:
                raise ValueError("Missing or duplicate application ID")
            if any(type(value) is not int for value in position) or position in occupied:
                raise ValueError("Invalid or colliding application coordinates")
            identifiers.add(identifier)
            occupied.add(position)
    if expected_nodes is not None and identifiers != expected_nodes:
        raise ValueError("Output does not contain exactly the input applications")
    for cluster in data["clusters"]:
        for application in cluster["applications"]:
            if any(connection["to"] not in identifiers for connection in application["connections"]):
                raise ValueError("Output contains a dangling connection")
    for center in data.get("projection", {}).get("centers", {}).values():
        if len(center) != 2 or any(not math.isfinite(value) for value in center):
            raise ValueError("Invalid previous community center")


def project_graph(graph, internal_k=0.1, meta_kk_scale=30.0, seed=42, indicator_threshold=15,
                  compute_internal=False, previous=None):
    if not graph:
        raise ValueError("No applications loaded")
    if previous is not None:
        validate_json(previous)
    signature_data = ["louvain-odd-r-v1", MAX_PER_ROW, CLUSTER_GAP, sorted(graph.nodes()), sorted((source, target, attributes["weight"])
                      for source, target, attributes in graph.edges(data=True)), meta_kk_scale, seed]
    signature = hashlib.sha256(json.dumps(signature_data, allow_nan=False).encode()).hexdigest()
    positions, clusters, centers = hierarchical_layout(graph, internal_k, meta_kk_scale, seed,
                                                       compute_internal, previous, signature)
    placements = place_clusters_on_hex_grid(clusters, centers)
    data = build_json(graph, clusters, placements, indicator_threshold)
    data["projection"] = {"version": 1, "coordinates": "odd-r", "signature": signature,
                          "centers": {f"cluster_{index + 1}": [float(value) for value in centers[index]]
                                      for index in range(len(clusters))}}
    return data, positions


def compare_layouts(previous, current, movement_threshold=5):
    if movement_threshold < 0:
        raise ValueError("Movement threshold must be nonnegative")

    def inventory(data):
        positions, memberships = {}, {}
        for cluster in data["clusters"]:
            members = frozenset(application["id"] for application in cluster["applications"])
            for application in cluster["applications"]:
                positions[application["id"]] = offset_to_axial(application["gridPosition"]["q"], application["gridPosition"]["r"])
                memberships[application["id"]] = members
        return positions, memberships

    previous_positions, previous_memberships = inventory(previous)
    current_positions, current_memberships = inventory(current)
    common = sorted(previous_positions.keys() & current_positions.keys())
    moves = []
    for identifier in common:
        delta_column = current_positions[identifier][0] - previous_positions[identifier][0]
        delta_row = current_positions[identifier][1] - previous_positions[identifier][1]
        moves.append({"id": identifier, "cells": max(abs(delta_column), abs(delta_row), abs(delta_column + delta_row))})
    distances = [move["cells"] for move in moves]
    return {"common_apps": len(common), "added": sorted(current_positions.keys() - previous_positions.keys()),
            "removed": sorted(previous_positions.keys() - current_positions.keys()),
            "changed_memberships": sum(previous_memberships[identifier] != current_memberships[identifier] for identifier in common),
            "moved_apps": sum(distance > 0 for distance in distances),
            "median_cells": float(np.median(distances)) if distances else 0,
            "p95_cells": float(np.percentile(distances, 95)) if distances else 0,
            "max_cells": max(distances, default=0), "movement_threshold": movement_threshold,
            "significant_moves": [move for move in moves if move["cells"] > movement_threshold]}


def write_json_atomic(path, data):
    path = Path(path)
    serialized = json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=path.parent,
                                         suffix=".json", delete=False) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(serialized)
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def save_png_debug(graph, positions, output_path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    maximum_weight = max((attributes["weight"] for _, _, attributes in graph.edges(data=True)), default=1)
    widths = [0.5 + 4 * attributes["weight"] / maximum_weight for _, _, attributes in graph.edges(data=True)]
    figure = plt.figure(figsize=(16, 12))
    try:
        nx.draw_networkx_edges(graph, positions, width=widths, alpha=0.4, edge_color="grey")
        nx.draw_networkx_nodes(graph, positions, node_size=35, node_color="#507ea4")
        if len(graph) <= 200:
            nx.draw_networkx_labels(graph, positions, font_size=7)
        plt.title("Flow communities before hex packing")
        plt.axis("off")
        plt.tight_layout()
        plt.savefig(output_path, format="png", dpi=150)
    finally:
        plt.close(figure)


def main():
    parser = argparse.ArgumentParser(description="Project weighted application flows into stable, packed HexMap communities.")
    parser.add_argument("--excel", type=Path, help="Excel workbook containing application flows.")
    parser.add_argument("--sheet", help="Worksheet name (required with --excel).")
    parser.add_argument("--nodes-json", type=Path, help="Optional JSON array of application IDs, including isolates.")
    parser.add_argument("--internal-k", type=float, default=0.1, help="Spring k for the optional PNG only.")
    parser.add_argument("--meta-kk-scale", type=float, default=30.0, help="Spread of connected community centers.")
    parser.add_argument("--indicator-threshold", type=int, default=15, help="Flag apps with strictly more outgoing targets.")
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--png-out", type=Path, default=DEFAULT_PNG_OUT)
    parser.add_argument("--no-png", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--previous-json", type=Path, help="Prior HexMap output for center reuse and drift comparison.")
    parser.add_argument("--report-out", type=Path, help="Write movement metrics (requires --previous-json).")
    parser.add_argument("--movement-threshold", type=int, default=5, help="Report significant movement above this many hex cells.")
    arguments = parser.parse_args()
    try:
        if bool(arguments.excel) != bool(arguments.sheet):
            raise ValueError("Supply both --excel and --sheet")
        if arguments.report_out and not arguments.previous_json:
            raise ValueError("--report-out requires --previous-json")
        if arguments.indicator_threshold < 0 or arguments.movement_threshold < 0:
            raise ValueError("Thresholds must be nonnegative")
        positive_number(arguments.internal_k)
        positive_number(arguments.meta_kk_scale)
        outputs = [arguments.json_out] + ([] if arguments.no_png else [arguments.png_out])
        outputs += [arguments.report_out] if arguments.report_out else []
        resolved_outputs = [path.resolve() for path in outputs]
        inputs = [path.resolve() for path in (arguments.excel, arguments.nodes_json) if path]
        if len(set(resolved_outputs)) != len(outputs) or any(path in inputs for path in resolved_outputs):
            raise ValueError("Output paths must be distinct and must not overwrite the source data")
        if arguments.previous_json and arguments.previous_json.resolve() in resolved_outputs[1:]:
            raise ValueError("Only --json-out may replace --previous-json")
        nodes = json.loads(arguments.nodes_json.read_text(encoding="utf-8")) if arguments.nodes_json else []
        if not isinstance(nodes, list) or any(not isinstance(node, str) for node in nodes):
            raise ValueError("--nodes-json must contain an array of application ID strings")
        edges = load_edges_from_excel(arguments.excel, arguments.sheet) if arguments.excel else ([] if arguments.nodes_json else load_edges_from_sample())
        graph = build_graph(edges, nodes)
        previous = json.loads(arguments.previous_json.read_text(encoding="utf-8")) if arguments.previous_json else None
        data, positions = project_graph(graph, arguments.internal_k, arguments.meta_kk_scale, arguments.seed,
                                        arguments.indicator_threshold, not arguments.no_png, previous)
        report = compare_layouts(previous, data, arguments.movement_threshold) if previous is not None else None
        if arguments.report_out:
            write_json_atomic(arguments.report_out, report)
        if not arguments.no_png:
            save_png_debug(graph, positions, arguments.png_out)
        write_json_atomic(arguments.json_out, data)
        print(f"HexMap JSON saved to {arguments.json_out}: {len(graph)} applications, {len(data['clusters'])} clusters")
        if report is not None:
            print(f"Layout drift: {report['moved_apps']}/{report['common_apps']} apps moved; "
                  f"{len(report['significant_moves'])} above {arguments.movement_threshold} cells")
    except (ValueError, TypeError, KeyError, OSError, OverflowError, nx.NetworkXException) as error:
        parser.exit(1, f"Error: {error}\n")


if __name__ == "__main__":
    main()
