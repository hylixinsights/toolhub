# Lattes × PubMed Atlas (website)

A static, four-tab website for the Lattes × PubMed analysis. Everything is in English.

- **About the analysis**: the pipeline from 453,549 Lattes CV researchers to the 24-cluster UMAP, with charts drawn from the run outputs.
- **Researchers in PubMed**: name search over the 184,714 researchers with at least one PubMed-linked record. A profile shows counts, first/last years, a per-year timeline (all / English / PubMed-linked records), national rank, rank inside the cluster, position on the map and the most characteristic MeSH terms. The default view is a ranking that can be filtered by cluster.
- **Clustering**: the compact UMAP (48,676 researchers) with cluster labels. Search a MeSH term to turn the map into a feature plot and get per-cluster violins; search or click a researcher to locate them and rank their MeSH terms by article count, z-score or TF-IDF.
- **MeSH Terms**: rank researchers by the number (or share) of their PubMed-linked articles carrying a term, plus the share of each cluster using it.

## Preview locally

The page loads its data with `fetch`, so it must be served over HTTP (opening `index.html` from disk will not work):

```bash
cd website
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Upload the contents of `website/` (at least `index.html` and `data/`) to any static host: GitHub Pages, Netlify, an institutional web server, or an S3 bucket. There is no server-side code. The only external resource is Google Fonts; without it the page falls back to system fonts.

## Rebuild

From `linkage_titulos/`:

```bash
python3 summarize_lattes_authors.py          # rebuild corrected author summary
python3 build_mesh_single_cell.py            # rebuild researcher x MeSH counts
python3 analyze_mesh_single_cell.py          # regenerate the analysis and UMAP
python3 annotate_mesh_clusters.py            # reassess and apply cluster labels
python3 build_author_year_counts.py        # per-researcher yearly counts (scans BaseD; ~40 s)
python3 figuras/pubmed_years_and_flows.py   # refresh PubMed-year and English x PubMed counts
python3 build_website_data.py              # writes website/data/ (needs numpy, pandas, scipy)
python3 website/assemble.py                # writes website/index.html from website/src/
```

`build_author_year_counts.py` uses the same exact-title rules as `summarize_lattes_authors.py` and checks that its per-researcher totals equal the summary file. Both use `csv.QUOTE_NONE` for the unquoted source TSVs. `build_website_data.py` reads the filtered matrix, annotations, markers and run reports in `mesh_single_cell_analysis_min10/`. Cluster labels and colours are tied to the current 24-cluster run; if clustering changes, reassess the labels and colours. Full cluster names are shown on the map only when there is enough width; the adjacent legend always gives the names.

## Data files (`data/`)

All `.txt` payloads are base64-encoded gzip streams (served as plain text by every static host, decoded in the browser). Integers are little-endian.

| File | Content |
|---|---|
| `meta.json` | Totals, pipeline numbers, per-year counts, PCA variance, parameter comparison, clusters (labels, anchors, top markers), dendrogram, shard offsets |
| `researchers.txt` | 184,714 researchers with ≥1 PubMed-linked record, sorted by that count (descending). Column-oriented UTF-8: 11 columns separated by U+001E, values by newlines: Lattes ID, name, first year, first English year, last year, last English year, total records, English records, PubMed records, first PubMed year, last PubMed year |
| `cells.txt` | For the 48,676 mapped researchers in matrix order: Float32 UMAP x, Float32 UMAP y, Uint32 researcher row, Float32 MeSH total (library size), Uint8 cluster |
| `mesh.txt` | JSON: the 9,529 retained MeSH names, researchers per term, total counts, mean and SD of the normalized level (for z-scores), best marker cluster, shard starts, and the 18,313 excluded rare terms with the reason |
| `mesh/mNNN.txt` | Column shards (one block per MeSH term): Uint32 nnz per term, Uint16 delta-encoded cell indices, Uint16 counts |
| `cells/cNNN.txt` | Row shards (1,000 cells each): Uint16 nnz per cell, Uint16 delta-encoded MeSH indices, Uint16 counts |
| `years/yNNN.txt` | Timeline shards (4,000 researchers each): Uint16 entries per researcher, then Uint16 quadruples (year, total, English, PubMed); year 0 = missing year |

Normalized level = log1p(count ÷ researcher's MeSH total × 10,000), as in the analysis. z-score = (level − mean over all 48,676 researchers) ÷ SD. TF-IDF = count × ln(48,676 ÷ researchers using the term).

## Credits

Lattes CVs from the BaseD collection obtained by Prof. Jesus Mena-Chalco's lab; PubMed/MEDLINE from the U.S. National Library of Medicine. Analysis by Jeevan Giddaluru and Helder Nakaya (CSBL).

## Data explorer

The `#explorer` tab adapts the three panels in `figuras/make_quadros_pt.py`: first English-publication year versus PubMed-linked records (default minimum 100), the five PubMed-count bins, and the record-level language/linkage flow. It uses the existing researcher payload and metadata, independently of the MeSH matrix. Name search highlights a researcher and can open their profile; minimum count and vertical scale are adjustable. Zero-PubMed researchers are included in the distribution but not in the searchable scatter plot.
