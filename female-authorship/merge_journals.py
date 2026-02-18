#!/usr/bin/env python3
"""
==========================================================================
MERGE: Junta todos os CSVs de journals em UMA tabela wide
==========================================================================
Uso:
  python merge_journals.py

Espera encontrar no diretório atual os CSVs gerados pelo fetch_gender.py:
  nature_authorship_gender.csv
  science_authorship_gender.csv
  cell_authorship_gender.csv
  nature_immunology_authorship_gender.csv
  ...etc

Output:
  all_journals_gender_summary.csv  — tabela wide (Year | Journal1 1st | Journal1 Last | ...)
  all_journals_gender_summary.tsv  — mesma coisa em TSV (para copiar no Excel/Sheets)
==========================================================================
"""

import os
import csv
import glob
from collections import defaultdict

# ── Lista de journals na ordem desejada das colunas ──
# Formato: (slug do arquivo, nome de display)
# O slug é o prefixo do CSV: {slug}_authorship_gender.csv
JOURNALS = [
    ("nature", "Nature"),
    ("science", "Science"),
    ("cell", "Cell"),
    ("nature_immunology", "Nature Immunology"),
    ("immunity", "Immunity"),
    ("science_immunology", "Science Immunology"),
    ("nature_medicine", "Nature Medicine"),
    ("nejm", "NEJM"),
    ("the_lancet", "The Lancet"),
    ("pnas", "PNAS"),
    ("nature_communications", "Nature Communications"),
    ("journal_of_immunology", "Journal of Immunology"),
]

YEAR_MIN = 2002
YEAR_MAX = 2025

OUTPUT_CSV = "all_journals_gender_summary.csv"
OUTPUT_TSV = "all_journals_gender_summary.tsv"


def compute_summary(csv_path: str) -> dict:
    """Lê um CSV de journal e retorna {year: (pct_F_first, pct_F_last)}."""
    stats = defaultdict(lambda: {"first_F": 0, "first_M": 0, "last_F": 0, "last_M": 0})

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            year = row.get("year", "")[:4]
            if not year.isdigit():
                continue
            y = int(year)
            if y < YEAR_MIN or y > YEAR_MAX:
                continue

            fg = row.get("first_author_gender", "U")
            lg = row.get("last_author_gender", "U")

            if fg == "F": stats[y]["first_F"] += 1
            elif fg == "M": stats[y]["first_M"] += 1
            if lg == "F": stats[y]["last_F"] += 1
            elif lg == "M": stats[y]["last_M"] += 1

    result = {}
    for y in range(YEAR_MIN, YEAR_MAX + 1):
        s = stats[y]
        fc = s["first_F"] + s["first_M"]
        lc = s["last_F"] + s["last_M"]
        pct_first = round(s["first_F"] / fc * 100, 1) if fc > 0 else None
        pct_last = round(s["last_F"] / lc * 100, 1) if lc > 0 else None
        result[y] = (pct_first, pct_last)

    return result


def main():
    print("=" * 70)
    print("MERGE — Tabela wide de todos os journals")
    print("=" * 70)

    all_data = {}  # journal_name -> {year: (pct_first, pct_last)}
    found = []
    missing = []

    for slug, name in JOURNALS:
        csv_path = f"{slug}_authorship_gender.csv"
        if os.path.exists(csv_path):
            print(f"  ✓ {name}: {csv_path}")
            all_data[name] = compute_summary(csv_path)
            found.append(name)
        else:
            print(f"  ✗ {name}: {csv_path} NÃO ENCONTRADO — pulando")
            missing.append(name)

    if not found:
        print("\nNenhum CSV encontrado! Rode fetch_gender.py primeiro.")
        return

    # ── Montar tabela wide ──
    headers = ["Year"]
    for name in found:
        headers.append(f"{name} 1st")
        headers.append(f"{name} Last")

    rows = []
    for year in range(YEAR_MIN, YEAR_MAX + 1):
        row = [year]
        for name in found:
            pct_first, pct_last = all_data[name].get(year, (None, None))
            row.append(pct_first if pct_first is not None else "")
            row.append(pct_last if pct_last is not None else "")
        rows.append(row)

    # ── Salvar CSV ──
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"\n  ✓ CSV: {OUTPUT_CSV}")

    # ── Salvar TSV ──
    with open(OUTPUT_TSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"  ✓ TSV: {OUTPUT_TSV}")

    # ── Preview ──
    print(f"\n{'=' * 70}")
    print(f"Preview ({len(found)} journals, {len(rows)} anos):")
    print("─" * 70)

    # Header
    print(f"{'Year':>6}", end="")
    for name in found:
        short = name[:12]
        print(f"  {short:>12} 1st  {short:>12} Last", end="")
    print()

    for row in rows[:5]:
        print(f"{row[0]:>6}", end="")
        for i in range(1, len(row), 2):
            v1 = f"{row[i]}%" if row[i] != "" else "—"
            v2 = f"{row[i+1]}%" if row[i+1] != "" else "—"
            print(f"  {v1:>16}  {v2:>16}", end="")
        print()
    print("  ...")

    if missing:
        print(f"\n⚠ Journals sem dados (CSV não encontrado): {', '.join(missing)}")

    print(f"\nColunas: {len(headers)} (1 Year + {len(found)} journals × 2)")
    print("Done!")


if __name__ == "__main__":
    main()
