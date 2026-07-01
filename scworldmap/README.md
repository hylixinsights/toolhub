# scWorldMap

An interactive single-cell–style world atlas for [toolhub.hylix.app](https://toolhub.hylix.app/).
Every country is a "cluster" of cells. Search countries to make a feature plot, or switch
views to Country population (viridis, log-scaled) or FIFA World Cup titles (gold scale).

## Files
- `index.html` — the tool (self-contained: HTML + CSS + JS)
- `data.json` — ~49k sampled points per country + population & World Cup titles

Data notes: populations are World Bank 2024 estimates (joined by ISO3). England is
split out of the UK polygon so it carries the 1966 World Cup title; the remaining
cluster (Scotland, Wales, N. Ireland) stays labelled "United Kingdom".

## Deploy (GitHub Pages)
Place this `scworldmap/` folder at the root of the `toolhub` repo. It will be served at:
`https://toolhub.hylix.app/scworldmap/`
The page loads `data.json` with a relative fetch, so no configuration is needed.

## Regenerate data
`export_data.py` (in the project) rebuilds `data.json` from Natural Earth country polygons.
