import json
import numpy as np
import geopandas as gpd
from shapely.geometry import Point, Polygon
from shapely.prepared import prep

rng = np.random.default_rng(42)
world = gpd.read_file("ne_data/naturalearth_lowres.shp")
world = world[world["name"] != "Antarctica"].copy()
world = world[~world.geometry.is_empty & world.geometry.notna()].reset_index(drop=True)

pop2024 = json.load(open("pop2024.json"))          # iso3 -> 2024 population (World Bank)
NAME2ISO = {"Kosovo": "XKX"}

# --- hand-traced England boundary (clockwise); clipped against UK polygon ----
ENGLAND = Polygon([
    (-5.8,49.8),(2.2,49.8),(2.2,53.0),(0.6,53.9),(-1.6,55.4),(-2.0,55.85),
    (-3.05,54.95),(-3.8,54.4),(-3.8,53.5),(-3.05,53.35),(-3.0,51.45),
    (-4.4,51.15),(-5.8,50.05),
])

# FIFA World Cup titles (through 2022); England now carries the 1966 title
WC = {"Brazil":5,"Germany":4,"Italy":4,"Argentina":3,"Uruguay":2,
      "France":2,"England":1,"Spain":1}

def sample_in_polygon(geom, n):
    if n <= 0 or geom.is_empty: return np.empty((0,2))
    minx, miny, maxx, maxy = geom.bounds
    pg = prep(geom); out = []
    batch = max(n * 3, 200)
    tries = 0
    while len(out) < n and tries < 400:
        tries += 1
        xs = rng.uniform(minx, maxx, batch); ys = rng.uniform(miny, maxy, batch)
        for x, y in zip(xs, ys):
            if pg.contains(Point(x, y)):
                out.append((x, y))
                if len(out) >= n: break
    return np.array(out) if out else np.empty((0,2))

# build the working list of (name, geometry, pop) — with UK split into England + rest
entries = []
uk_total = pop2024.get("GBR", 67000000)
ENG_POP = 57700000
for _, row in world.iterrows():
    name = row["name"]; geom = row.geometry
    iso = NAME2ISO.get(name, row["iso_a3"])
    pop = pop2024.get(iso, int(row["pop_est"]) if row["pop_est"]==row["pop_est"] else 0)
    if name == "United Kingdom":
        eng = geom.intersection(ENGLAND)
        rest = geom.difference(ENGLAND)
        entries.append(("England", eng, ENG_POP))
        entries.append(("United Kingdom", rest, max(0, uk_total - ENG_POP)))
    else:
        entries.append((name, geom, pop))

areas = np.array([g.area for _, g, _ in entries])
POINTS_TOTAL = 70000
pts = np.clip((areas / areas.sum() * POINTS_TOTAL).astype(int), 25, 2600)

# graph coloring for cluster palette
from shapely.strtree import STRtree
geoms = [g for _, g, _ in entries]
tree = STRtree(geoms)
neighbors = {i:set() for i in range(len(entries))}
for i, g in enumerate(geoms):
    for j in tree.query(g):
        j=int(j)
        if j!=i and g.touches(geoms[j]): neighbors[i].add(j)
order = [int(k) for k in np.argsort(-areas)]
color_idx={}; big=set(order[:16]); big_used=set()
PALETTE_N=30
for i in order:
    forbidden={color_idx[n] for n in neighbors[i] if n in color_idx}
    if i in big: forbidden|=big_used
    c=next(k for k in range(PALETTE_N) if k not in forbidden)
    color_idx[i]=c
    if i in big: big_used.add(c)

countries=[]
for i,(name,geom,pop) in enumerate(entries):
    p=sample_in_polygon(geom,int(pts[i]))
    if len(p)==0: continue
    countries.append({
        "name":name,"pop":int(pop),"wc":WC.get(name,0),"c":int(color_idx[i]),
        "x":[round(float(v),2) for v in p[:,0]],
        "y":[round(float(v),2) for v in p[:,1]],
    })
json.dump({"countries":countries},
          open("/sessions/hopeful-modest-dirac/mnt/UMAP/scworldmap/data.json","w"),
          separators=(",",":"))
tot=sum(len(c["x"]) for c in countries)
print("countries",len(countries),"points",tot)
eng=[c for c in countries if c["name"]=="England"][0]
uk=[c for c in countries if c["name"]=="United Kingdom"][0]
print("England pts",eng["n"] if "n" in eng else len(eng["x"]),"pop",eng["pop"],"wc",eng["wc"])
print("UK rest pts",len(uk["x"]),"pop",uk["pop"],"wc",uk["wc"])
