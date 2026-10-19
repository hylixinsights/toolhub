Space Immunology Atlas
Public URL: https://toolhub.hylix.app/spaceimmunology/

Static dashboard for the RRRM-2 Live Animal Return cohort.
Female C57BL/6NTac mice, 12 or 29 weeks at launch, 32 days on the ISS
followed by 24 days of recovery. All contrasts are flight versus ground
within age. This design does not isolate microgravity.

Serve this folder with any static web server. No build step is required.
Data paths are relative, so the dashboard can run in a subdirectory.
Modern browsers require DecompressionStream support for gzip decoding.
D3 7.8.5 loads from cdnjs; Public Sans and IBM Plex Mono from Google Fonts.

Data provenance: NASA OSDR OSD-402, OSD-403, OSD-404 and OSD-405.
Exports supplied by Mamede, Ishihara, Rojas-Celis and Nakaya.
GSEA uses GSEA_GOBP_no_ribo; ribosomal and mitochondrial genes excluded.
Within-cell-type gene hits at FDR < 0.05: 0; whole-tissue hits: 11.
GSEA: 3,971 significant pathway-comparison results, 1,272 unique terms.
Gene DE uses per-mouse pseudobulk, 3–4 animals per condition.
LIANA/CellPhoneDB results use cell permutations; detection categories
are not mouse-level differential communication tests.
Leading-edge exports are truncated to 20 genes.
The same mice contribute to multiple cellular contexts and marrow sites.

data/*.jgz.txt: base64-encoded gzipped JSON, decoded in the browser.
data/meta.json: metadata, composition, concordance and LIANA summaries.
data/insights.json: descriptive summaries; inferential claims are limited
by the qualifications displayed in the interface.

Scientific wording reviewed 2026-10-19 against supplied result tables.
Manuscript remains in preparation. Findings are transcriptomic; they do
not establish functional immune impairment, osteoporosis or thrombosis.
