# Application-flow projection

`scripts/graph_layout_packed.py` is the existing flow-network generator, extended
under TECH-102. It discovers communities from weighted flows, places related
communities near each other, and packs each community in rows of up to ten apps.
It feeds the existing React viewer without a separate renderer or embedding stack.

## Run

Use an already-provisioned interpreter. On this workstation the project uses
`C:\miniconda3\envs\python310\python.exe`. All commands below run from the repo root.
The dependency declarations are in `tools/requirements.txt`; running the generator
does not install or update packages.

Generate the built-in synthetic sample and a diagnostic PNG:

```bat
C:\miniconda3\envs\python310\python.exe scripts\graph_layout_packed.py --json-out sample.json --png-out sample.png
```

Read a workbook and write the viewer's data file:

```bat
C:\miniconda3\envs\python310\python.exe scripts\graph_layout_packed.py --excel flows.xlsx --sheet Flows --no-png
```

Both Excel arguments are required together. The worksheet must contain:

| Column | Meaning |
| --- | --- |
| `Source Application` | Source application ID/name |
| `Target Application` | Target application ID/name |
| `Duplication Count` | Finite positive flow weight |

The file may contain other columns. Identifiers are trimmed; missing identifiers
or weights are rejected. Duplicate source/target rows are summed. Reverse flows
remain separate directed output connections, while both directions contribute to
undirected community affinity. Self-flows remain in the output but do not affect
community detection. Output connection strength is `low` below 250, `medium` from
250 to below 500, and `high` from 500, based on the summed directed weight.

An edge list cannot identify applications with no flows. Supply an optional JSON
array of ID strings to include those applications:

```json
["Trading", "Risk", "Isolated application"]
```

```bat
C:\miniconda3\envs\python310\python.exe scripts\graph_layout_packed.py --excel flows.xlsx --sheet Flows --nodes-json applications.json --no-png
```

`--nodes-json` alone generates a map of isolated applications. Without a workbook
or node inventory, the generator loads `sample_data.py` when present alongside it,
otherwise the synthetic built-in sample. Keep private samples and workbooks out of
source control.

## Output and geometry

The default JSON destination resolves to this checkout's `src/data.json`, regardless
of the working directory. `--json-out PATH` overrides it. The default PNG destination
is `graph_layout_final.png` in the working directory; `--png-out PATH` overrides it.
`--no-png` also skips internal spring-layout calculations and Matplotlib imports.

The JSON retains `clusters[].applications[]`, application IDs/names/status/colors,
directed connections, explicit positions, cluster positions, and `hexCount`.
Additional top-level `projection` metadata stores the input/configuration signature
and continuous community centers for subsequent comparisons. The viewer ignores it.

The viewer interprets `gridPosition.q` as an **odd-r offset column** and `r` as a row.
The generator performs packing and collision checks in pointy-top axial coordinates,
then converts to odd-r at serialization. Each next packed row starts half a hex
column to the left in the viewer, including at negative and odd-row origins.
Community targets refer to the center of their packed shapes. A two-cell buffer
separates applications in different communities; the viewer places labels in nearby
white space using its existing label-placement logic. Generated maps open fitted to
the viewport, with additional zoom-out levels for large networks and a scrollable
legend. Background/reset actions return to that overview; legend entries zoom to
individual communities.

Positive flow weights feed seeded Louvain community detection. A separate inverse weight feeds
Kamada-Kawai's distance calculation, so stronger intercommunity affinity means a
shorter desired distance. Disconnected components occupy separate compact islands.
Cluster-size sorting and collision resolution can distort desired distances; this
is a discrete visual layout, not a metric embedding.

The finite placement search fails with a nonzero exit if it cannot fit a shape;
it never knowingly writes colliding or incomplete app positions. JSON publication
uses atomic replacement, preserving the last good JSON on validation/layout/write
failure. PNG and optional drift-report outputs are separate files, not a transaction
with the JSON. Distinct output paths are required, and source workbooks/inventories
cannot be overwritten by an output.

## Stability and indicators

Same inputs/configuration and package versions produce identical JSON across input
row permutations and Python hash seeds. Community IDs are deterministically ordered
`cluster_N` values; membership changes may renumber them.

Compare a new run with a prior result:

```bat
C:\miniconda3\envs\python310\python.exe scripts\graph_layout_packed.py --excel flows.xlsx --sheet Flows --previous-json yesterday.json --report-out drift.json --movement-threshold 5 --json-out today.json --no-png
```

The previous and destination JSON may be the same path: the previous data is read
before publication. The report lists added/removed apps, changed memberships,
median/p95/max displacement, moved-app count, and app IDs moving **more than** the
configured number of hex cells. A console summary is printed even without
`--report-out`. Previous files without `projection` metadata still support drift
comparison, but cannot supply continuous center initializations.

With unchanged input/configuration, previous centers are reused exactly. When a
connected graph changes, exactly matching communities supply initial positions;
split/merged communities do not borrow unrelated centers. Disconnected islands are
repacked deterministically on changes. Changes may still cause large movement; the
report makes that visible rather than promising incremental stability. Scheduling
daily runs and ingesting additional affinity sources are outside this generator.

`--indicator-threshold N` flags applications with **strictly more than N distinct
outgoing targets** (default 15). At 15, an app with 16 outgoing targets is flagged;
one with 15, or only incoming flows, is not. Repeated flow rows and their weights
do not inflate this count. This corrects the historical inclusive total-degree rule.

`--meta-kk-scale` controls the spread of connected community centers (default 30),
multiplied by `max(1, sqrt(application_count) / 10)` to allow for their packed
footprints. This avoids forcing thousands of apps into the sample graph's small
area and then losing affinity during collision resolution. Two empty hex cells
between communities also leave room for the viewer's perimeter labels.
`--internal-k` (default 0.1) affects the diagnostic PNG only. `--seed` (default 42)
seeds Louvain community detection and internal spring layouts. Canonical graph
insertion and community/center ordering make a fixed seed repeatable. The palette
uses blue/purple hues, reserving red/amber/green for status.

## Verification

On the workstation, the regression suite lives in the canonical script directory:

```bat
C:\miniconda3\envs\python310\python.exe -B C:\scripts\test_hexmap_projection.py
npm test -- --watchAll=false --runInBand
```

The Python suite checks weight aggregation, affinity, repeatability, row geometry,
collision failure, indicators, Excel/Unicode/PNG output, isolates, previous-layout
comparison, and preservation of existing output on errors. Workbooks in the suite
are synthetic. `C:\scripts\_oneshot_tech102_verify.py prepare` runs the 6,000-app
sparse, skewed, and isolated benchmark fixtures and records memory/time plus schema
and intercluster-gap checks under `C:\Users\user\notes\evidence`.

The September 2026 sparse fixture contains 6,000 apps and 18,060 directed edges in
60 populations. It is a reproducible workload, not a production SLA. Dense networks,
many mutually connected communities, and the actual enterprise workbook can have
different costs. For large production inputs use `--no-png`; the optional diagnostic
per-community spring solver may be expensive. The existing SVG viewer may also need
zooming and panning for a map of this size.

Louvain replaces greedy modularity after the skewed 6,000-app verification case
took 104 seconds. An isolated 1,000-app star reproduced 17.916 seconds in greedy
modularity versus 0.020 seconds in the already-installed Louvain implementation.
This changes community partitions; it does not add a dependency. The seed and
ordering regression tests cover the resulting repeatability contract.

Provenance: retained design conversation `681a65d7-5f18-8003-a7ae-77c908187229`,
especially its final two-level packing requirement. The generator was already
imported into this repo in commit `a34e077`; TECH-102 reconciles and corrects it.
The [NetworkX distance-layout contract](https://networkx.org/documentation/networkx-3.2.1/reference/generated/networkx.drawing.layout.kamada_kawai_layout.html)
and [hex coordinate conversion guide](https://www.redblobgames.com/grids/hexagons/#conversions-offset)
explain the weight and coordinate conventions used here.
