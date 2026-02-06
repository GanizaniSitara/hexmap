#!/usr/bin/env python3
"""
ServiceNow CMDB + Confluence Ingest for HexMap

Reads business application data from ServiceNow CMDB exports and enriches
with Confluence content from pickle files, then generates a hex map layout.

Data Sources:
  1. ServiceNow CMDB export (CSV/JSON) - application portfolio
  2. Confluence pickle files (optional) - enrichment docs per space/app

Classification:
  Apps are classified as Business or Technical/Infrastructure based on
  ServiceNow CI class, category fields, and keyword heuristics.

Usage:
    # From ServiceNow CMDB CSV export
    python servicenow_ingest.py cmdb_export.csv

    # With Confluence pickle directory for enrichment
    python servicenow_ingest.py cmdb_export.csv --confluence-dir ./pickles/

    # From ServiceNow JSON export
    python servicenow_ingest.py cmdb_export.json --format json

    # Preview without writing
    python servicenow_ingest.py cmdb_export.csv --preview

    # Override classification with a mapping file
    python servicenow_ingest.py cmdb_export.csv --classification-map overrides.csv
"""

import argparse
import csv
import json
import os
import pickle
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# Import the layout engine from continent_layout
sys.path.insert(0, str(Path(__file__).parent))
from continent_layout import App, ContinentLayoutEngine


# ─── Classification Rules ────────────────────────────────────────────────────
# These heuristics classify a ServiceNow CI as "business" or "technical".
# Override per-app with --classification-map.

# ServiceNow CI classes that are almost always technical infrastructure
TECHNICAL_CI_CLASSES = {
    "cmdb_ci_server",
    "cmdb_ci_win_server",
    "cmdb_ci_linux_server",
    "cmdb_ci_unix_server",
    "cmdb_ci_esx_server",
    "cmdb_ci_vm_instance",
    "cmdb_ci_cloud_service_account",
    "cmdb_ci_cloud_database",
    "cmdb_ci_database",
    "cmdb_ci_db_instance",
    "cmdb_ci_db_ora_instance",
    "cmdb_ci_db_mssql_instance",
    "cmdb_ci_app_server",
    "cmdb_ci_web_server",
    "cmdb_ci_lb",
    "cmdb_ci_lb_ace",
    "cmdb_ci_netgear",
    "cmdb_ci_ip_switch",
    "cmdb_ci_ip_router",
    "cmdb_ci_ip_firewall",
    "cmdb_ci_storage_device",
    "cmdb_ci_storage_volume",
    "cmdb_ci_san_fabric",
    "cmdb_ci_cluster",
    "cmdb_ci_kubernetes_cluster",
    "cmdb_ci_docker_container",
    "cmdb_ci_cloud_load_balancer",
    "cmdb_ci_middleware",
    "cmdb_ci_mq",
}

# ServiceNow CI classes that are almost always business applications
BUSINESS_CI_CLASSES = {
    "cmdb_ci_business_app",
    "cmdb_ci_service",
    "cmdb_ci_service_discovered",
    "cmdb_ci_service_auto",
    "service_offering",
    "cmdb_ci_appl",
}

# Keywords that suggest technical/infrastructure (matched against name + description)
TECHNICAL_KEYWORDS = [
    r"\baws\b", r"\bazure\b", r"\bgcp\b", r"\bcloud\b",
    r"\bkubernetes\b", r"\bk8s\b", r"\bdocker\b", r"\bcontainer\b",
    r"\bserver\b", r"\binfrastructure\b", r"\bmiddleware\b",
    r"\bnetwork\b", r"\bfirewall\b", r"\bload.?balancer\b",
    r"\bdatabase\b", r"\bdb\b", r"\boracle\b", r"\bmssql\b", r"\bpostgres\b",
    r"\bsql.?server\b", r"\bmysql\b", r"\bmongodb\b", r"\bredis\b",
    r"\belasticsearch\b", r"\bkafka\b", r"\brabbitmq\b", r"\bmq\b",
    r"\bstorage\b", r"\bsan\b", r"\bnas\b", r"\bs3\b",
    r"\bsnowflake\b", r"\bredshift\b", r"\bbigquery\b",
    r"\bcicd\b", r"\bci/cd\b", r"\bjenkins\b", r"\bgitlab\b", r"\bgithub\b",
    r"\bterraform\b", r"\bansible\b", r"\bpuppet\b", r"\bchef\b",
    r"\bmonitoring\b", r"\bapm\b", r"\bdatadog\b", r"\bsplunk\b", r"\bnagios\b",
    r"\bdns\b", r"\bdhcp\b", r"\bvpn\b", r"\bproxy\b",
    r"\bvmware\b", r"\bhypervisor\b", r"\besx\b",
    r"\bbackup\b", r"\breplication\b", r"\bdr\b",
    r"\bapi.?gateway\b", r"\bservice.?mesh\b", r"\bistio\b",
]

# Keywords that suggest business application
BUSINESS_KEYWORDS = [
    r"\bcrm\b", r"\berp\b", r"\bhcm\b", r"\bhrms\b", r"\bhris\b",
    r"\bpayroll\b", r"\baccounting\b", r"\bfinancial\b", r"\bbudget\b",
    r"\binvoice\b", r"\bprocurement\b", r"\bvendor\b",
    r"\brecruiting\b", r"\btalent\b", r"\bonboarding\b", r"\blearning\b",
    r"\bsales\b", r"\bmarketing\b", r"\bcampaign\b", r"\bleads?\b",
    r"\bcustomer\b", r"\bsupport\b", r"\bticket\b", r"\bservice.?desk\b",
    r"\bcontent.?management\b", r"\bcms\b", r"\bportal\b",
    r"\bbilling\b", r"\bsubscription\b", r"\bcommerce\b", r"\bcart\b",
    r"\bcompliance\b", r"\baudit\b", r"\brisk\b", r"\blegal\b",
    r"\bcontract\b", r"\bdocument.?management\b",
    r"\bproject.?management\b", r"\bjira\b", r"\bconfluence\b",
    r"\bcollaboration\b", r"\bteams?\b", r"\bslack\b",
    r"\bworkflow\b", r"\bapproval\b", r"\bcase.?management\b",
    r"\banalytics\b", r"\breporting\b", r"\bdashboard\b",
    r"\bsalesforce\b", r"\bsap\b", r"\bworkday\b", r"\bservicenow\b",
]

# When classifying into business domains, map keywords to domain names
DOMAIN_KEYWORDS = {
    "Finance": [
        r"\bfinance\b", r"\baccounting\b", r"\bpayroll\b", r"\btax\b",
        r"\bbudget\b", r"\bforecast\b", r"\binvoice\b", r"\btreasury\b",
        r"\bprocurement\b", r"\bexpense\b", r"\baudit\b", r"\bcash\b",
        r"\bledger\b", r"\breceivable\b", r"\bpayable\b", r"\berp\b",
        r"\bsap\b",
    ],
    "HR": [
        r"\bhr\b", r"\bhuman.?resource\b", r"\bpayroll\b", r"\brecruit\b",
        r"\btalent\b", r"\bonboard\b", r"\blearn\b", r"\btraining\b",
        r"\bperformance\b", r"\bbenefit\b", r"\bcompensation\b",
        r"\bworkforce\b", r"\bemployee\b", r"\bhcm\b", r"\bhris\b",
        r"\bworkday\b", r"\bsuccessfactors\b",
    ],
    "Sales": [
        r"\bsales\b", r"\bcrm\b", r"\bpipeline\b", r"\blead\b",
        r"\bopportunit\b", r"\bquote\b", r"\bcontract\b", r"\bterritor\b",
        r"\bcommission\b", r"\bforecast\b", r"\bcustomer.?relat\b",
        r"\bsalesforce\b", r"\bdeal\b", r"\baccount.?manag\b",
    ],
    "Marketing": [
        r"\bmarket\b", r"\bcampaign\b", r"\bemail\b", r"\bsocial\b",
        r"\bcontent\b", r"\bbrand\b", r"\bseo\b", r"\banalytics\b",
        r"\bad\b", r"\badvert\b", r"\bwebsite\b", r"\bcms\b",
        r"\bhubspot\b", r"\bmarketo\b",
    ],
    "IT": [
        r"\bit\b", r"\bservice.?desk\b", r"\basset.?manag\b",
        r"\bchange.?manag\b", r"\bincident\b", r"\bproblem\b",
        r"\bcmdb\b", r"\bconfiguration\b", r"\brelease\b",
        r"\bsecurity\b", r"\bidentity\b", r"\baccess\b",
        r"\biam\b", r"\bsso\b", r"\bmfa\b",
    ],
    "Operations": [
        r"\boperation\b", r"\bsupply.?chain\b", r"\blogistic\b",
        r"\bwarehouse\b", r"\binventory\b", r"\bshipping\b",
        r"\bfulfill\b", r"\bmanufactur\b", r"\bquality\b",
    ],
    "Customer": [
        r"\bcustomer\b", r"\bsupport\b", r"\bservice\b", r"\bportal\b",
        r"\bself.?service\b", r"\bchat\b", r"\bticket\b", r"\bcase\b",
        r"\bknowledge.?base\b",
    ],
    "Data & Analytics": [
        r"\bdata\b", r"\banalytics\b", r"\breport\b", r"\bdashboard\b",
        r"\bwarehouse\b", r"\blake\b", r"\bbi\b", r"\bbusiness.?intel\b",
        r"\bpower.?bi\b", r"\btableau\b", r"\blooker\b",
    ],
}


@dataclass
class CmdbApp:
    """Represents an app record from the ServiceNow CMDB."""
    sys_id: str = ""
    name: str = ""
    ci_class: str = ""
    category: str = ""
    subcategory: str = ""
    description: str = ""
    short_description: str = ""
    operational_status: str = ""
    owner: str = ""
    support_group: str = ""
    department: str = ""
    business_unit: str = ""
    environment: str = ""
    version: str = ""
    vendor: str = ""
    used_for: str = ""
    managed_by: str = ""
    relationships: List[str] = field(default_factory=list)

    # Derived fields
    is_business: Optional[bool] = None
    domain: str = ""
    confluence_content: str = ""


def classify_app(app: CmdbApp, overrides: Dict[str, dict] = None) -> Tuple[bool, str]:
    """
    Classify a CMDB app as business vs technical, and assign a business domain.

    Returns (is_business, domain_name).
    """
    # Check overrides first
    if overrides and app.name in overrides:
        override = overrides[app.name]
        return override.get("is_business", True), override.get("domain", "Other")

    # 1. Check CI class
    ci_lower = app.ci_class.lower().strip()
    if ci_lower in TECHNICAL_CI_CLASSES:
        return False, "Infrastructure"
    if ci_lower in BUSINESS_CI_CLASSES:
        # It's a business app, determine domain below
        pass

    # 2. Score based on keyword matching against name + description
    text = f"{app.name} {app.short_description} {app.description} {app.category} {app.subcategory}".lower()

    tech_score = 0
    biz_score = 0

    for pattern in TECHNICAL_KEYWORDS:
        if re.search(pattern, text, re.IGNORECASE):
            tech_score += 1

    for pattern in BUSINESS_KEYWORDS:
        if re.search(pattern, text, re.IGNORECASE):
            biz_score += 1

    # Tiebreaker: if CI class suggests business, lean that way
    if ci_lower in BUSINESS_CI_CLASSES:
        biz_score += 3

    # If department or business_unit is set, boost business score
    if app.department or app.business_unit:
        biz_score += 1

    is_business = biz_score >= tech_score

    # 3. Determine domain
    domain = _classify_domain(app)

    if not is_business:
        domain = "Infrastructure"

    return is_business, domain


def _classify_domain(app: CmdbApp) -> str:
    """Determine the business domain for an app."""
    text = f"{app.name} {app.short_description} {app.description} {app.category} {app.subcategory} {app.department} {app.business_unit}".lower()

    scores = {}
    for domain, patterns in DOMAIN_KEYWORDS.items():
        score = 0
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                score += 1
        if score > 0:
            scores[domain] = score

    if scores:
        return max(scores, key=scores.get)

    # Fallback: use department or business_unit if available
    if app.department:
        for domain, patterns in DOMAIN_KEYWORDS.items():
            for pattern in patterns:
                if re.search(pattern, app.department.lower()):
                    return domain

    if app.business_unit:
        for domain, patterns in DOMAIN_KEYWORDS.items():
            for pattern in patterns:
                if re.search(pattern, app.business_unit.lower()):
                    return domain

    return "Other"


# ─── ServiceNow CMDB Readers ─────────────────────────────────────────────────

# Standard ServiceNow CMDB export column names and their common aliases
SNOW_COLUMN_MAP = {
    # sys_id
    "sys_id": "sys_id", "sysid": "sys_id", "id": "sys_id",
    # name
    "name": "name", "ci_name": "name", "display_name": "name",
    "application_name": "name", "app_name": "name",
    # class
    "sys_class_name": "ci_class", "ci_class": "ci_class", "class": "ci_class",
    "type": "ci_class",
    # category
    "category": "category", "app_category": "category",
    # subcategory
    "subcategory": "subcategory", "sub_category": "subcategory",
    # description
    "description": "description", "long_description": "description",
    # short description
    "short_description": "short_description", "summary": "short_description",
    # operational status
    "operational_status": "operational_status", "status": "operational_status",
    "install_status": "operational_status",
    # owner
    "owned_by": "owner", "owner": "owner", "managed_by": "managed_by",
    "assigned_to": "owner", "support_group": "support_group",
    # department/org
    "department": "department", "dept": "department",
    "business_unit": "business_unit", "org": "business_unit",
    "company": "business_unit",
    # tech detail
    "environment": "environment", "env": "environment",
    "version": "version", "vendor": "vendor",
    "used_for": "used_for",
    # relationships (when denormalized)
    "relationships": "relationships", "depends_on": "relationships",
    "connects_to": "relationships", "related_cis": "relationships",
}


def read_cmdb_csv(filepath: str) -> List[CmdbApp]:
    """Read a ServiceNow CMDB CSV export."""
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    apps = []

    # Detect delimiter
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        sample = f.read(4096)
        if '\t' in sample and sample.count('\t') > sample.count(','):
            delimiter = '\t'
        else:
            delimiter = ','

    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=delimiter)

        # Build column mapping
        col_map = {}
        if reader.fieldnames:
            for fn in reader.fieldnames:
                normalized = fn.lower().strip().replace(' ', '_').replace('-', '_')
                if normalized in SNOW_COLUMN_MAP:
                    col_map[fn] = SNOW_COLUMN_MAP[normalized]
                else:
                    col_map[fn] = normalized

        for row in reader:
            mapped = {col_map.get(k, k): v.strip() if v else "" for k, v in row.items()}

            # Skip rows without a name
            name = mapped.get("name", "")
            if not name:
                continue

            app = CmdbApp(
                sys_id=mapped.get("sys_id", ""),
                name=name,
                ci_class=mapped.get("ci_class", ""),
                category=mapped.get("category", ""),
                subcategory=mapped.get("subcategory", ""),
                description=mapped.get("description", ""),
                short_description=mapped.get("short_description", ""),
                operational_status=mapped.get("operational_status", ""),
                owner=mapped.get("owner", ""),
                support_group=mapped.get("support_group", ""),
                department=mapped.get("department", ""),
                business_unit=mapped.get("business_unit", ""),
                environment=mapped.get("environment", ""),
                version=mapped.get("version", ""),
                vendor=mapped.get("vendor", ""),
                used_for=mapped.get("used_for", ""),
                managed_by=mapped.get("managed_by", ""),
            )

            # Parse relationships if present
            rel_str = mapped.get("relationships", "")
            if rel_str:
                app.relationships = [r.strip() for r in rel_str.replace(",", ";").split(";") if r.strip()]

            apps.append(app)

    return apps


def read_cmdb_json(filepath: str) -> List[CmdbApp]:
    """Read a ServiceNow CMDB JSON export (records array or result wrapper)."""
    filepath = Path(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Handle ServiceNow API wrapper: { "result": [...] }
    if isinstance(data, dict) and "result" in data:
        records = data["result"]
    elif isinstance(data, list):
        records = data
    else:
        raise ValueError("Unexpected JSON structure. Expected array or {result: [...]}.")

    apps = []
    for rec in records:
        # Handle nested display values: {"value": "...", "display_value": "..."}
        def get_val(key):
            v = rec.get(key, "")
            if isinstance(v, dict):
                return v.get("display_value", v.get("value", ""))
            return str(v) if v else ""

        name = get_val("name") or get_val("ci_name") or get_val("display_name")
        if not name:
            continue

        app = CmdbApp(
            sys_id=get_val("sys_id"),
            name=name,
            ci_class=get_val("sys_class_name"),
            category=get_val("category"),
            subcategory=get_val("subcategory"),
            description=get_val("description"),
            short_description=get_val("short_description"),
            operational_status=get_val("operational_status") or get_val("install_status"),
            owner=get_val("owned_by") or get_val("assigned_to"),
            support_group=get_val("support_group"),
            department=get_val("department"),
            business_unit=get_val("business_unit") or get_val("company"),
            environment=get_val("environment"),
            version=get_val("version"),
            vendor=get_val("vendor"),
            used_for=get_val("used_for"),
            managed_by=get_val("managed_by"),
        )

        # Relationships from denormalized fields
        for rel_key in ["depends_on", "relates_to", "connects_to", "used_by"]:
            rel_val = get_val(rel_key)
            if rel_val:
                app.relationships.extend([r.strip() for r in rel_val.split(";") if r.strip()])

        apps.append(app)

    return apps


# ─── Confluence Enrichment ────────────────────────────────────────────────────

def load_confluence_pickles(pickle_dir: str) -> Dict[str, str]:
    """
    Load Confluence content from pickle files.

    Expects either:
      - One pickle per space: <space_key>.pkl containing a list of page dicts
      - One big pickle: confluence_export.pkl containing all pages

    Each page dict should have at least: {"title": "...", "body": "..."}
    We match pages to apps by title similarity.

    Returns: { app_name_lower: concatenated_content }
    """
    pickle_dir = Path(pickle_dir)
    if not pickle_dir.exists():
        print(f"Warning: Confluence pickle directory not found: {pickle_dir}")
        return {}

    all_pages = []

    for pkl_file in sorted(pickle_dir.glob("*.pkl")):
        try:
            with open(pkl_file, 'rb') as f:
                data = pickle.load(f)

            if isinstance(data, list):
                all_pages.extend(data)
            elif isinstance(data, dict):
                # Could be {space_key: [pages]} or a single page
                if "title" in data:
                    all_pages.append(data)
                else:
                    for key, value in data.items():
                        if isinstance(value, list):
                            all_pages.extend(value)
            print(f"  Loaded {pkl_file.name}")
        except Exception as e:
            print(f"  Warning: Could not load {pkl_file.name}: {e}")

    if not all_pages:
        print(f"Warning: No pages found in {pickle_dir}")
        return {}

    print(f"  Total Confluence pages loaded: {len(all_pages)}")

    # Build lookup: lowercase title/name -> content
    content_map = {}
    for page in all_pages:
        title = ""
        body = ""

        if isinstance(page, dict):
            title = page.get("title", "") or page.get("name", "")
            body = page.get("body", "") or page.get("content", "") or page.get("text", "")
        elif isinstance(page, str):
            continue  # Skip if it's just a string

        if title:
            # Strip HTML tags from body if present
            clean_body = re.sub(r'<[^>]+>', ' ', body)
            clean_body = re.sub(r'\s+', ' ', clean_body).strip()
            content_map[title.lower().strip()] = clean_body

    return content_map


def enrich_with_confluence(apps: List[CmdbApp], confluence_content: Dict[str, str]):
    """Match CMDB apps to Confluence pages and enrich descriptions."""
    if not confluence_content:
        return

    matched = 0
    for app in apps:
        name_lower = app.name.lower().strip()

        # Try exact match first
        if name_lower in confluence_content:
            app.confluence_content = confluence_content[name_lower]
            matched += 1
            continue

        # Try partial match: page title contains app name or vice versa
        for page_title, content in confluence_content.items():
            if name_lower in page_title or page_title in name_lower:
                app.confluence_content = content
                matched += 1
                break

    print(f"  Confluence enrichment: {matched}/{len(apps)} apps matched")


# ─── Classification Overrides ─────────────────────────────────────────────────

def load_classification_overrides(filepath: str) -> Dict[str, dict]:
    """
    Load manual classification overrides from a CSV file.

    Expected format:
        app_name,is_business,domain
        Snowflake,false,Infrastructure
        SAP ERP,true,Finance
    """
    overrides = {}
    filepath = Path(filepath)
    if not filepath.exists():
        print(f"Warning: Override file not found: {filepath}")
        return overrides

    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("app_name", "").strip()
            if not name:
                continue
            is_biz_str = row.get("is_business", "true").strip().lower()
            domain = row.get("domain", "Other").strip()
            overrides[name] = {
                "is_business": is_biz_str in ("true", "1", "yes", "y"),
                "domain": domain,
            }

    print(f"  Loaded {len(overrides)} classification overrides")
    return overrides


# ─── Pipeline: CMDB → Layout Engine ──────────────────────────────────────────

def operational_status_to_score(status: str) -> int:
    """Convert ServiceNow operational_status to a 0-100 health score."""
    status_lower = status.lower().strip()

    # ServiceNow standard operational status values
    status_map = {
        "operational": 90,
        "1": 90,  # Operational
        "non-operational": 15,
        "2": 15,  # Non-operational
        "repair in progress": 40,
        "3": 40,
        "dr standby": 60,
        "4": 60,
        "ready": 80,
        "5": 80,
        "retired": 5,
        "6": 5,  # Retired
        "pipeline": 50,
        "7": 50,
        "catalog": 70,
        "8": 70,
    }

    for key, score in status_map.items():
        if key in status_lower:
            return score

    # Try parsing as a number
    try:
        val = int(float(status_lower))
        return max(0, min(100, val))
    except ValueError:
        return 75  # Default


def cmdb_to_layout_apps(
    cmdb_apps: List[CmdbApp],
    overrides: Dict[str, dict] = None,
    include_technical: bool = False,
    map_type: str = "business",
) -> List[App]:
    """
    Convert classified CMDB apps to the layout engine's App format.

    map_type:
        "business" - Only business apps, grouped by business domain
        "technical" - Only technical apps, grouped by technology category
        "all" - Everything, business apps by domain, technical by "Infrastructure"
    """
    layout_apps = []
    name_to_id = {}  # For resolving relationships

    classification_summary = defaultdict(lambda: {"business": 0, "technical": 0})

    for cmdb_app in cmdb_apps:
        is_business, domain = classify_app(cmdb_app, overrides)
        cmdb_app.is_business = is_business
        cmdb_app.domain = domain

        classification_summary[domain]["business" if is_business else "technical"] += 1

        # Filter based on map_type
        if map_type == "business" and not is_business:
            continue
        if map_type == "technical" and is_business:
            continue

        # Generate a clean ID
        app_id = re.sub(r'[^a-zA-Z0-9_]', '_', cmdb_app.name).strip('_')
        name_to_id[cmdb_app.name] = app_id

        # Build description from available fields
        desc = cmdb_app.short_description or cmdb_app.description or ""
        if cmdb_app.confluence_content and len(desc) < 100:
            # Use first 200 chars of Confluence content as extended description
            desc = cmdb_app.confluence_content[:200].strip()
            if len(cmdb_app.confluence_content) > 200:
                desc += "..."

        status = operational_status_to_score(cmdb_app.operational_status)

        app = App(
            id=app_id,
            name=cmdb_app.name,
            business=domain,
            status=status,
            description=desc,
            connections=[],  # Resolved below
        )
        layout_apps.append(app)

    # Resolve relationships to app IDs
    for cmdb_app in cmdb_apps:
        app_id = name_to_id.get(cmdb_app.name)
        if not app_id:
            continue

        layout_app = next((a for a in layout_apps if a.id == app_id), None)
        if not layout_app:
            continue

        for rel_name in cmdb_app.relationships:
            target_id = name_to_id.get(rel_name)
            if target_id and target_id != app_id:
                layout_app.connections.append(target_id)

    # Print classification summary
    print("\nClassification summary:")
    print(f"  {'Domain':<25} {'Business':>10} {'Technical':>10}")
    print(f"  {'-'*25} {'-'*10} {'-'*10}")
    for domain in sorted(classification_summary.keys()):
        counts = classification_summary[domain]
        print(f"  {domain:<25} {counts['business']:>10} {counts['technical']:>10}")
    total_biz = sum(c["business"] for c in classification_summary.values())
    total_tech = sum(c["technical"] for c in classification_summary.values())
    print(f"  {'TOTAL':<25} {total_biz:>10} {total_tech:>10}")

    print(f"\nApps going into layout ({map_type} map): {len(layout_apps)}")

    return layout_apps


def enhance_output(output: dict, cmdb_apps: List[CmdbApp]) -> dict:
    """Add CMDB metadata to the layout output (owner, version, techStack, etc.)."""
    # Build lookup by name
    cmdb_lookup = {app.name: app for app in cmdb_apps}

    for cluster in output.get("clusters", []):
        # Add cluster-level metadata
        cluster_apps = cluster.get("applications", [])
        if cluster_apps:
            # Find a representative owner for the cluster
            owners = [cmdb_lookup[a["name"]].owner for a in cluster_apps
                      if a["name"] in cmdb_lookup and cmdb_lookup[a["name"]].owner]
            if owners:
                from collections import Counter
                most_common_owner = Counter(owners).most_common(1)[0][0]
                cluster["leadName"] = most_common_owner

            # Find a representative department
            depts = [cmdb_lookup[a["name"]].department for a in cluster_apps
                     if a["name"] in cmdb_lookup and cmdb_lookup[a["name"]].department]
            if depts:
                cluster["department"] = Counter(depts).most_common(1)[0][0]

        for app_data in cluster_apps:
            cmdb_app = cmdb_lookup.get(app_data["name"])
            if not cmdb_app:
                continue

            if cmdb_app.owner:
                app_data["owner"] = cmdb_app.owner
            if cmdb_app.version:
                app_data["version"] = cmdb_app.version
            if cmdb_app.vendor:
                app_data["techStack"] = [cmdb_app.vendor]
            if cmdb_app.description and not app_data.get("description"):
                app_data["description"] = cmdb_app.description[:300]

    return output


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Ingest ServiceNow CMDB data into HexMap layout',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic: CSV export from ServiceNow
  python servicenow_ingest.py cmdb_apps.csv

  # With Confluence enrichment
  python servicenow_ingest.py cmdb_apps.csv --confluence-dir ./confluence_pickles/

  # JSON from ServiceNow API
  python servicenow_ingest.py cmdb_export.json --format json

  # Technical infrastructure map instead of business
  python servicenow_ingest.py cmdb_apps.csv --map-type technical

  # Override classifications for specific apps
  python servicenow_ingest.py cmdb_apps.csv --classification-map overrides.csv

  # Preview classification without generating layout
  python servicenow_ingest.py cmdb_apps.csv --preview

ServiceNow CMDB CSV columns (all optional except name):
  name, sys_class_name, category, subcategory, short_description,
  description, operational_status, owned_by, department, business_unit,
  environment, version, vendor, depends_on

Classification override CSV:
  app_name,is_business,domain
  Snowflake,false,Infrastructure
  SAP ERP,true,Finance
        """
    )

    parser.add_argument('input', help='ServiceNow CMDB export (CSV or JSON)')
    parser.add_argument('-f', '--format', choices=['csv', 'json'], default=None,
                        help='Input format (auto-detected from extension if omitted)')
    parser.add_argument('-o', '--output', default='../src/data.json',
                        help='Output JSON file (default: ../src/data.json)')
    parser.add_argument('--confluence-dir',
                        help='Directory containing Confluence pickle files')
    parser.add_argument('--classification-map',
                        help='CSV file with manual classification overrides')
    parser.add_argument('--map-type', choices=['business', 'technical', 'all'],
                        default='business',
                        help='Type of map to generate (default: business)')
    parser.add_argument('-p', '--preview', action='store_true',
                        help='Preview classification without generating layout')
    parser.add_argument('-s', '--seed', type=int, default=42,
                        help='Random seed (default: 42)')
    parser.add_argument('--water-gap', type=int, default=2,
                        help='Hex gap between unconnected continents (default: 2)')
    parser.add_argument('--connected-gap', type=int, default=1,
                        help='Hex gap between connected continents (default: 1)')
    parser.add_argument('--positions', default=None, metavar='FILE',
                        help='Position cache file for topographic stability')
    parser.add_argument('--reset', action='store_true',
                        help='Ignore position cache and recompute from scratch')

    args = parser.parse_args()

    # Determine format
    fmt = args.format
    if not fmt:
        ext = Path(args.input).suffix.lower()
        fmt = "json" if ext == ".json" else "csv"

    # Read CMDB data
    print(f"Reading CMDB export ({fmt}): {args.input}")
    if fmt == "json":
        cmdb_apps = read_cmdb_json(args.input)
    else:
        cmdb_apps = read_cmdb_csv(args.input)
    print(f"  Loaded {len(cmdb_apps)} CMDB records")

    # Load Confluence content if provided
    confluence_content = {}
    if args.confluence_dir:
        print(f"\nLoading Confluence content from: {args.confluence_dir}")
        confluence_content = load_confluence_pickles(args.confluence_dir)
        enrich_with_confluence(cmdb_apps, confluence_content)

    # Load classification overrides
    overrides = {}
    if args.classification_map:
        print(f"\nLoading classification overrides: {args.classification_map}")
        overrides = load_classification_overrides(args.classification_map)

    # Convert to layout apps
    print(f"\nClassifying apps (map type: {args.map_type})...")
    layout_apps = cmdb_to_layout_apps(
        cmdb_apps,
        overrides=overrides,
        map_type=args.map_type,
    )

    if args.preview:
        print("\n[Preview mode - no layout generated]")
        return

    if not layout_apps:
        print("\nError: No apps to lay out after classification.")
        print("Try --map-type all to include everything.")
        return

    # Resolve positions file
    positions_file = None
    if args.positions and not args.reset:
        positions_file = str(Path(args.positions))

    # Run layout engine
    print(f"\nRunning continent layout engine...")
    engine = ContinentLayoutEngine(
        water_gap=args.water_gap,
        connected_gap=args.connected_gap,
        seed=args.seed,
        collision_rate=0,  # No artificial collisions for real data
        indicator_rate=0.1,
        positions_file=positions_file,
    )
    engine.load_apps(layout_apps)
    output = engine.generate_layout()

    # Enhance output with CMDB metadata
    output = enhance_output(output, cmdb_apps)

    # Write output
    output_path = Path(__file__).parent / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nWritten to: {output_path}")
    print(f"Continents: {len(output['clusters'])}")
    total_apps = sum(len(c['applications']) for c in output['clusters'])
    print(f"Applications: {total_apps}")

    print("\nContinent summary:")
    for cluster in output['clusters']:
        conn_count = sum(len(a.get('connections', [])) for a in cluster['applications'])
        print(f"  {cluster['name']}: {cluster['hexCount']} apps, {conn_count} connections")


if __name__ == '__main__':
    main()
