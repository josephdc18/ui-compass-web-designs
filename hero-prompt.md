# Moments — Infinite Photo Wall with a Cursor-Driven Gravity Void

> A full-viewport mosaic of 55 photographs that crystallises into place on
> page load, parts wherever the cursor goes, pans the wall when you click an
> image (the image stays put, the world moves), and never reaches an edge
> because the tile wraps in both axes. Every photo carries its own aspect
> (landscape / square / portrait) so the wall reads as a real museum-print
> wall, not a uniform grid. The wall idles with a slow per-row drift in
> alternating directions, which keeps the focal photo changing under the
> cursor as the wall scrolls past.
>
> This file is the section's full specification — a developer or AI agent
> reading only this `.md` should be able to rebuild the section pixel-perfect.

---

## 1. Vision & feel

- **Read it as a photo wall, not a grid.** Every cell has a real aspect ratio. The eye never groups cells into rows because adjacent cells are different widths.
- **Cursor IS the void.** Wherever the cursor sits over the section, the wall parts in a circle around it. The cursor isn't decorated with a custom shape — the *clearing* is the cursor.
- **Drift, never still.** When idle, each row slides at its own slow pace in alternating directions (≈ 3–15 px/sec). The featured photo at the void changes naturally as the wall scrolls past.
- **Click is a camera move.** The clicked image stays where it is in the world; the camera (pan) slides until that image is at the viewport centre, then locks. Detail content surrounds the image — title above, location/date + caption + CTAs below, share icons stacked on each side. There is no modal.
- **Prev/next is wall-only motion.** Once the detail is open the featured image is locked at viewport centre. Next/prev change the photo and slide the wall behind it; the image position never moves.
- **Three-stage gravity radius.** Idle (cursor outside section) = smallest. Hover (cursor inside) = medium. Detail open = largest.
- **Theme-aware.** Section background, hero copy, dim overlay, detail text and icons all swap between light and dark via CSS variables.
- **One continuous intro.** Cells crystallise from the centre outward in a radial wave (with a rush-inward fly), the void opens at the same moment (matched to a real mouse-hover), the featured photo lands inside the opening void, and the hero copy cascades over the second half — all overlapping, no "wait then next" beats.

---

## 2. Architecture

```
<section>     ← full viewport, theme bg, overflow:hidden, isolate, select-none
  <div>×N     ← photo cells — absolute, positioned per-frame by tick (z auto)
  <div>       ← gradient backdrop (z-14) — bottom-left soft tint for hero
  <div>       ← dim overlay (z-20, conditional while expanded — theme-tinted)
  <div>       ← featured anchor (z-30) — transform = void position every frame
    <FeaturedCard>
      <div>     ← title block (absolute bottom-full): arrows row, category, title
      <div>     ← left side icons (absolute right-full, desktop only when expanded)
      <div>     ← right side icons (absolute left-full, desktop only when expanded)
      <div>     ← image wrapper (overflow-hidden, rounded, bg-black placeholder)
        <img>     ← single src, never swapped on expand (no fetch flicker)
        <div>     ← rest-state caption strip (bottom gradient — only when !expanded)
      <div>     ← below block (absolute top-full):
                    location · year strip
                    mobile-only icon row (5 actions)
                    description (desktop only)
                    [Order print] [Inquire] buttons
  <div>       ← hero copy (z-35) — bottom-left, hidden on mobile while expanded
  <div>       ← interaction hint (z-40) — top-right, fades on first move
</section>
```

**Z-stack rationale:** the gradient sits BELOW the dim overlay so the expanded
state cleanly tints both together; the hero copy sits ABOVE the featured
(z-30) so the floating featured never covers the title when the cursor
wanders into the bottom-left corner; the hint sits above everything so it
fades cleanly regardless of state.

---

## 3. Coordinate system

Two spaces, related by **`screen = world + panOff`**:

| Space  | Origin              | What lives here                                       |
|--------|---------------------|-------------------------------------------------------|
| WORLD  | (0, 0) = tile centre| Cell `baseX` / `baseY`, `voidWorld`, displacement math |
| SCREEN | viewport top-left   | Cursor (`mouseRef`), final transforms                  |

Default `panOff = (vw/2, vh/2)` so world (0, 0) starts at viewport centre. On click-to-open the pan target becomes `(vw/2 − voidWorld.x, vh/2 − voidWorld.y)` so the clicked world point ends up at viewport centre when the pan settles.

---

## 4. Constants

```ts
/* Grid cell row height — every cell shares this; widths vary by photo aspect */
const CELL_H_DESKTOP   = 100;
const CELL_H_MOBILE    = 72;
const CELL_GAP_DESKTOP = 12;
const CELL_GAP_MOBILE  = 8;

/* Tile scale — wall wraps every tileW × tileH. Bigger tile = more unique
   content before any visible repeat. */
const TILE_SCALE_DESKTOP = 3;     // wall is 3× viewport in each axis
const TILE_SCALE_MOBILE  = 2.6;

/* Gravity void radii — three sizes */
const VOID_RADIUS_IDLE_DESKTOP     = 200;   // cursor outside section
const VOID_RADIUS_HOVER_DESKTOP    = 280;   // cursor over section
const VOID_RADIUS_EXPANDED_DESKTOP = 420;   // detail open
const VOID_RADIUS_IDLE_MOBILE      = 130;
const VOID_RADIUS_HOVER_MOBILE     = 180;
const VOID_RADIUS_EXPANDED_MOBILE  = 280;

/* Physics tuning */
const VOID_LERP      = 0.25;   // cursor-tracking speed (snappy)
const PAN_LERP       = 0.07;   // wall-pan speed after a click (~0.6s settle)
const RADIUS_LERP    = 0.07;   // void dilate/contract speed (matches pan)
const SOFT_PUSH_RATIO= 1.3;    // cells within R × 1.3 receive displacement
```

```ts
/* Per-row drift — adjacent rows go opposite directions at hashed speeds */
function rowDriftSpeed(rowIndex: number): number {
  const magnitude = 0.05 + hash(rowIndex * 41.3 + 17.1) * 0.18;  // 0.05 → 0.23 px/frame
  const sign = rowIndex % 2 === 0 ? -1 : 1;
  return magnitude * sign;
}
```

At 60 fps, drift is ~3–14 px/sec per row — slow enough to feel alive without ever feeling like the page is scrolling.

---

## 5. Hash + helpers

```ts
function hash(n: number): number {
  // Sine-fract — cheap, deterministic, well-distributed for small inputs
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
```

`Math.random()` is **never** called in this section. Every per-cell value is
hashed from `(row, col-within-row)` at build time, so resizing the viewport
gives the user the same wall — only the count changes.

---

## 6. Photo set

```ts
interface Photo {
  id: string;          // Unsplash photo ID (the part after `photo-` in the URL)
  title: string;       // poetic
  category: string;    // single word (Landscape / Nature / Portrait / etc.)
  description: string; // 1–2 sentence field note
  aspect: number;      // width / height — 1.5 landscape, 1.0 square, 0.75 portrait
  location: string;    // free-form place name
  year: number;        // capture year
}
```

**URL builders** (the only network the section needs):

```ts
function thumbUrl(id: string, aspect: number, cellHeight: number): string {
  const h = Math.round(cellHeight * 2.4);  // ×2.4 for retina sharpness
  const w = Math.round(h * aspect);
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=70&auto=format`;
}

function featuredUrl(id: string, aspect: number): string {
  const h = 720;
  const w = Math.round(h * aspect);
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;
}
```

**`featuredUrl` is used for both the rest and the expanded featured display** — at 720 px tall it's already retina-sharp at the largest expanded frame (~360 × 2 = 720 raster). The same `<img>` element is reused across rest/expanded (single src, no key), so the browser never has to fetch a different URL on click. This is the single most important detail for a flicker-free zoom.

### Photo set (55 entries)

```ts
const PHOTOS: Photo[] = [
  { id: "1506905925346-21bda4d32df4", title: "Granite Light",         category: "Landscape", aspect: 1.5,  location: "French Alps",            year: 2023, description: "Morning broke quietly over the alpine ridge — fifteen minutes after sunrise, before the wind picked up." },
  { id: "1469474968028-56623f02e42e", title: "Far Saddle",            category: "Landscape", aspect: 1.5,  location: "Aiguille du Midi",       year: 2022, description: "From the bivouac at 3,200 metres the saddle looked closer than it was — three hours' walk, easy." },
  { id: "1518837695005-2083093ee35b", title: "Field of Hours",        category: "Nature",    aspect: 1.5,  location: "Valensole, Provence",    year: 2021, description: "Provence in late June — every horizon was the same shade of unrepeatable violet." },
  { id: "1441974231531-c6227db76b6e", title: "October",     category: "Landscape", aspect: 1.5,  location: "Aspen, Colorado",        year: 2023, description: "The aspens held their breath for one afternoon, then let it go all at once." },
  { id: "1470071459604-3b5ec3a7fe05", title: "First Breath",          category: "Landscape", aspect: 0.75, location: "Big Sur, California",    year: 2022, description: "Coastal fog crept up the valley between five and six — by seven the trees were still again." },
  { id: "1447752875215-b2761acb3c5d", title: "A Slow Window",         category: "Landscape", aspect: 1.0,  location: "British Columbia",       year: 2024, description: "Sunlight angled through the cedars for maybe twenty minutes a day in November — this was eight of them." },
  { id: "1500964757637-c85e8a162699", title: "Last Pier",             category: "Landscape", aspect: 1.5,  location: "Burleigh Heads, AU",     year: 2020, description: "The old timber pier at Burleigh has been condemned for years. The sunsets don't seem to mind." },
  { id: "1454496522488-7a8e488e8606", title: "Sleeping Giant",        category: "Landscape", aspect: 1.5,  location: "Mont Blanc Massif",      year: 2022, description: "Three thousand metres of silence — the only motion was the snow drifting off the cornice." },
  { id: "1501785888041-af3ef285b470", title: "Honey Hour",            category: "Landscape", aspect: 1.5,  location: "Val d'Orcia, Tuscany",   year: 2023, description: "The valley filled like a cup, slowly, with light the colour of pulled honey." },
  { id: "1444080748397-f442aa95c3e5", title: "Silver Bones",          category: "Nature",    aspect: 0.75, location: "Hokkaido, Japan",        year: 2024, description: "A birch grove in February — every trunk a struck match, every shadow a perfect parallel." },
  { id: "1431794062232-2a99a5431c6c", title: "Quiet Walk",            category: "Nature",    aspect: 0.75, location: "Muir Woods, California", year: 2021, description: "The trail through the redwoods at Muir — when you stop walking, the silence becomes its own thing." },
  { id: "1426604966848-d7adac402bff", title: "Iron Coast",            category: "Landscape", aspect: 1.5,  location: "Reynisfjara, Iceland",   year: 2022, description: "The northern Atlantic doesn't visit gently. The rocks have been negotiating with it for a hundred million years." },
  { id: "1490604001847-b712b0c2f967", title: "Field of Old Light",    category: "Night",     aspect: 1.5,  location: "Atacama, Chile",         year: 2023, description: "Atacama Desert, October new moon — every photon that landed had been travelling for thousands of years." },
  { id: "1497436072909-60f360e1d4b1", title: "Spring Run",            category: "Landscape", aspect: 1.5,  location: "Geirangerfjord, Norway", year: 2023, description: "The snowmelt had peaked the week before — the stream was still loud, but starting to clear." },
  { id: "1505144808419-1957a94ca61e", title: "The Carve",             category: "Landscape", aspect: 0.75, location: "Antelope Canyon, Arizona", year: 2022, description: "A river cut this with patience. The walls keep score in red and rust and amber bands." },
  { id: "1505765050516-f72dcac9c60e", title: "Equatorial Calm",       category: "Travel",    aspect: 1.0,  location: "Bora Bora",              year: 2024, description: "Late afternoon in the leeward Pacific — the palm fronds rasp like newspaper in a slow wind." },
  { id: "1542273917363-3b1817f69a2d", title: "Open Country",          category: "Landscape", aspect: 1.5,  location: "Pinedale, Wyoming",      year: 2021, description: "Wyoming, US-191 north of Pinedale — the kind of horizon you have to stand still to understand." },
  { id: "1418065460487-3e41a6c84dc5", title: "Red Patience",          category: "Landscape", aspect: 1.5,  location: "Sossusvlei, Namibia",    year: 2022, description: "The Namib at first light — the dunes look painted, but they move five centimetres a year." },
  { id: "1502082553048-f009c37129b9", title: "After the Rain",        category: "Nature",    aspect: 1.0,  location: "Cotswolds, England",     year: 2023, description: "Twenty minutes after a brief shower — the petals held more light than the sky." },
  { id: "1483347756197-71ef80e95f73", title: "Slow Burn",             category: "Landscape", aspect: 1.5,  location: "Stowe, Vermont",         year: 2022, description: "The maples behind the old farmhouse don't drop their colour all at once. They take a week. They take their time." },
  { id: "1485470733090-0aae1788d5af", title: "Tideline",              category: "Landscape", aspect: 1.5,  location: "Sennen Cove, Cornwall",  year: 2021, description: "Where the sea wrote a long sentence and revised it, every six hours, for ten thousand years." },
  { id: "1495107334309-fcf20504a5ab", title: "Glass Geometry",        category: "Architecture", aspect: 0.75, location: "Berlin, Germany",     year: 2020, description: "A façade from the late 1960s, photographed in winter sun — the geometry hadn't aged a day." },
  { id: "1472213984618-c79aaec7fef0", title: "Russet Hour",           category: "Landscape", aspect: 1.0,  location: "Catskills, New York",    year: 2022, description: "Late October in the Catskills — the air smelt like apple cider and stone." },
  { id: "1480714378408-67cf0d13bc1b", title: "Held Sky",              category: "Landscape", aspect: 1.5,  location: "Moraine Lake, Banff",    year: 2024, description: "Calm enough that the lake doubled the mountain — for about ninety seconds, before a fish broke the spell." },
  { id: "1449034446853-66c86144b0ad", title: "Weather Bringing",      category: "Sky",       aspect: 1.5,  location: "Isle of Skye, Scotland", year: 2023, description: "The first front of October pushing south — twenty-six minutes before the rain arrived." },
  { id: "1506744038136-46273834b3fb", title: "Soft Water",            category: "Landscape", aspect: 1.5,  location: "Lake District, UK",      year: 2022, description: "An unnamed tarn in the Lakes District — the kind of place that asks you to whisper for no good reason." },
  { id: "1519681393784-d120267933ba", title: "Pass Above the Clouds", category: "Landscape", aspect: 1.5,  location: "Passo dello Stelvio",    year: 2023, description: "The Stelvio at first light — the inversion held in the valley, the road climbed clear of it." },
  { id: "1500530855697-b586d89ba3ee", title: "Cold Country",          category: "Landscape", aspect: 1.5,  location: "Torres del Paine",       year: 2024, description: "Above the treeline, sixty kilometres from the nearest road, an hour before the wind started moving." },
  { id: "1469854523086-cc02fe5d8800", title: "Sand Hours",            category: "Travel",    aspect: 1.5,  location: "Wadi Rum, Jordan",       year: 2023, description: "Wadi Rum at the threshold of evening — the sand changed colour faster than I could meter for it." },
  { id: "1488972685288-c3fd157d7c7a", title: "White Memory",          category: "Architecture", aspect: 0.75, location: "Cádiz, Andalusia",    year: 2022, description: "A modernist house on the Andalusian coast — built in 1962, repainted every spring since." },
  { id: "1518173946687-a4c8892bbd9f", title: "The Last Ridge",        category: "Landscape", aspect: 1.5,  location: "Karakoram, Pakistan",    year: 2024, description: "From the col, the ridge ahead looked impossible. It usually does, then it doesn't." },
  { id: "1444723121867-7a241cacace9", title: "Spire",                 category: "Landscape", aspect: 0.75, location: "Chamonix, France",       year: 2023, description: "An aiguille in the Mont Blanc massif — climbed in 1881, photographed at sunrise on a clearer Tuesday." },
  { id: "1492446845049-9c50cc313f00", title: "Spring Returns",        category: "Nature",    aspect: 1.5,  location: "Yorkshire Dales",        year: 2024, description: "The first green of the year — three days of warmth was all it took for the whole valley to flip." },
  { id: "1465379944081-7f47de8d74ac", title: "Painted Strand",        category: "Travel",    aspect: 1.0,  location: "Algarve, Portugal",      year: 2023, description: "A beach hut on the Algarve coast — repainted in slightly different colours every summer, by the same family, for sixty years." },
  { id: "1499002238440-d264edd596ec", title: "A Brief Pink",          category: "Still Life",aspect: 1.0,  location: "Studio, London",         year: 2024, description: "Peonies last about three days indoors. This one lasted ten minutes — long enough." },
  { id: "1483728642387-6c3bdd6c93e5", title: "Stand of Pines",        category: "Nature",    aspect: 0.75, location: "Black Forest, Germany",  year: 2023, description: "A grove on the ridge — straight as a question mark, every one of them the same age." },
  { id: "1438761681033-6461ffad8d80", title: "October Smile",         category: "Portrait",  aspect: 0.75, location: "Brooklyn, New York",     year: 2022, description: "An editorial test, supposed to take twenty minutes. We were laughing about something else, and the picture made itself." },
  { id: "1500916434205-0c77489c6cf7", title: "Long Afternoon",        category: "Landscape", aspect: 1.5,  location: "Outer Banks, NC",        year: 2024, description: "Eastern coast, last week of August — a tide so low it seemed to be considering not coming back." },
  { id: "1486325212027-8081e485255e", title: "Soft Modern",           category: "Architecture", aspect: 0.75, location: "Lisbon, Portugal",    year: 2023, description: "A residential block, late afternoon — the pink picking up the sky's pink, and giving it back." },
  { id: "1494500764479-0c8f2919a3d8", title: "Found Water",           category: "Nature",    aspect: 1.0,  location: "Pyrenees",               year: 2023, description: "A pool nobody mapped — the trail walked past it twice before noticing it was there at all." },
  { id: "1417325384643-aac51acc9e5d", title: "Refuge",                category: "Landscape", aspect: 1.5,  location: "Tatra Mountains",        year: 2023, description: "A cabin in the Tatras — three days' walk from the nearest road, two thousand metres above the noise." },
  { id: "1448375240586-882707db888b", title: "Stone & Sky",           category: "Landscape", aspect: 1.5,  location: "Dolomites, Italy",       year: 2022, description: "Above the cloud layer at sunrise — the kind of view that doesn't repeat in a season." },
  { id: "1465056836041-7f43ac27dcb5", title: "First Snow",            category: "Landscape", aspect: 1.5,  location: "Sierra Nevada",          year: 2023, description: "Mid-October on the eastern face — the year's first dusting, gone by Tuesday." },
  { id: "1464822759023-fed622ff2c3b", title: "The Walk Up",           category: "Landscape", aspect: 1.5,  location: "Glacier National Park",  year: 2022, description: "Three hours to the saddle, the kind of hike where you don't notice the time passing." },
  { id: "1493246507139-91e8fad9978e", title: "Sunbeams",              category: "Nature",    aspect: 1.5,  location: "Olympic Peninsula",      year: 2023, description: "Half an hour after sunrise the fog parted, just long enough to see the floor of the forest." },
  { id: "1466692476868-aef1dfb1e735", title: "Cloud Drift",           category: "Sky",       aspect: 1.5,  location: "Western Colorado",       year: 2024, description: "Cirrus clouds at fifteen thousand feet, photographed from a small plane circling slow." },
  { id: "1455218873509-8097305ee378", title: "Sea Edge",              category: "Landscape", aspect: 1.5,  location: "Faroe Islands",          year: 2023, description: "Faroe Islands, late June — the basalt cliffs run for kilometres, never the same shape twice." },
  { id: "1481018085669-2bc6e4f00eed", title: "Wide Open",             category: "Landscape", aspect: 1.5,  location: "Nevada, USA",            year: 2022, description: "American west, off-highway — fifty kilometres of nothing in any direction." },
  { id: "1473773508845-188df298d2d1", title: "Boardwalk",             category: "Nature",    aspect: 1.5,  location: "Estonia",                year: 2023, description: "A wooden path through wetland — built by hand, maintained by no one in particular." },
  { id: "1470770841072-f978cf4d019e", title: "Drift Country",         category: "Landscape", aspect: 1.5,  location: "Utah",                   year: 2022, description: "Twilight over the high desert — the sky goes through every colour it knows in twelve minutes." },
  { id: "1487958449943-2429e8be8625", title: "Steel & Sun",           category: "Architecture", aspect: 0.75, location: "Chicago",             year: 2023, description: "A late-modernist office block, photographed in winter at the moment the sun crosses the corner." },
  { id: "1486718448742-163732cd1544", title: "Spiral",                category: "Architecture", aspect: 0.75, location: "Vienna",              year: 2022, description: "A staircase in a museum addition, designed by an architect known for exactly one good idea." },
  { id: "1525134479668-1bee5c7c6845", title: "Mid-Sentence",          category: "Portrait",  aspect: 0.75, location: "Berlin",                 year: 2023, description: "Not posed — between answers to a question I'd already forgotten the start of." },
  { id: "1517248135467-4c7edcad34c4", title: "Slow Cup",              category: "Still Life",aspect: 1.0,  location: "Studio",                 year: 2024, description: "A morning espresso, photographed with the same lens I've used every morning for ten years." },
  { id: "1542038784456-1ea8e935640e", title: "Wildflower Hour",       category: "Nature",    aspect: 1.5,  location: "Cumbria, UK",            year: 2023, description: "Wildflower meadow at full peak — twenty-three species in a square metre, by the gardener's count." },
];
```

Aspect distribution: ~28 landscape (1.5), ~14 portrait (0.75), ~8 square (1.0), and a few outliers. Swap any single ID to change a slot — every URL is built from the ID.

---

## 7. Build the wall (`buildCells`)

The wall is a finite TILE that wraps in both axes. Within the tile, cells are laid out row by row. Every row shares the same height (`cellH`) but cells take different widths (`cellH × aspect`). Adjacent cells never share the same photo (anti-collision logic).

```ts
interface Cell {
  index: number;
  rowIndex: number;  // row in the tile — drift offsets keyed by this
  baseX: number;     // canonical WORLD x, centred on 0
  baseY: number;
  width: number;     // varies per photo aspect
  height: number;    // constant per row
  photoIndex: number;
  angle: number;     // fallback push direction at the exact void centre
  rotation: number;  // ±1.8° baked-in rotation
  scale: number;     // ±2.5% baked-in scale jitter
}

interface TileSize {
  width: number;
  height: number;
  rows: number;
}

function buildCells(dims: { vw: number; vh: number; isMobile: boolean }): {
  cells: Cell[];
  tile: TileSize;
} {
  const { vw, vh, isMobile } = dims;
  const cellH = isMobile ? CELL_H_MOBILE : CELL_H_DESKTOP;
  const gap   = isMobile ? CELL_GAP_MOBILE : CELL_GAP_DESKTOP;
  const scale = isMobile ? TILE_SCALE_MOBILE : TILE_SCALE_DESKTOP;
  const stepY = cellH + gap;

  const targetTileW = vw * scale;
  const targetTileH = vh * scale;

  const rows  = Math.ceil(targetTileH / stepY);
  const tileH = rows * stepY;            // exact period for vertical wrap
  const firstRowY = -tileH / 2 + cellH / 2 + gap / 2;

  // --- Pass 1: pick photos with anti-collision; record natural row widths
  const rawRows: Array<Array<{ photoIndex: number; width: number; rawX: number; colIdx: number }>> = [];
  let maxNaturalWidth = 0;
  let prevRow: typeof rawRows[number] | null = null;

  for (let r = 0; r < rows; r++) {
    const rowItems: typeof rawRows[number] = [];
    let rawX = 0, colIdx = 0;

    while (rawX < targetTileW) {
      let candidate = Math.floor(hash(r * 17.3 + colIdx * 31.7 + 5) * PHOTOS.length);

      // Anti-collision — never repeat the left neighbour or the cell whose
      // x-range overlaps the current cell's left edge in the previous row
      const leftIdx = rowItems.length > 0 ? rowItems[rowItems.length - 1].photoIndex : -1;
      let aboveIdx = -1;
      if (prevRow) {
        for (const prev of prevRow) {
          if (rawX >= prev.rawX && rawX < prev.rawX + prev.width + gap) {
            aboveIdx = prev.photoIndex;
            break;
          }
        }
      }
      let attempts = 0;
      while ((candidate === leftIdx || candidate === aboveIdx) && attempts < PHOTOS.length) {
        candidate = (candidate + 1) % PHOTOS.length;
        attempts++;
      }

      const aspect = PHOTOS[candidate].aspect;
      const width = cellH * aspect;
      rowItems.push({ photoIndex: candidate, width, rawX, colIdx });
      rawX += width + gap;
      colIdx++;
    }
    rawRows.push(rowItems);
    prevRow = rowItems;

    const rowNaturalWidth = rawX - gap;
    if (rowNaturalWidth > maxNaturalWidth) maxNaturalWidth = rowNaturalWidth;
  }

  // --- Tile width is the LARGEST natural row width — every other row gets
  // its `gap` widened uniformly so all rows occupy exactly `tileW`.
  // This makes the horizontal wrap seamless (no row tears at the seam).
  const tileW = maxNaturalWidth + gap;

  // --- Pass 2: commit Cell objects with the row centred on world x = 0
  const cells: Cell[] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    const rowItems = rawRows[r];
    if (rowItems.length === 0) continue;
    const rowNaturalWidth =
      rowItems[rowItems.length - 1].rawX + rowItems[rowItems.length - 1].width;
    const extra = tileW - rowNaturalWidth - gap;
    const extraPerGap = rowItems.length > 1 ? extra / rowItems.length : 0;

    let runningX = -tileW / 2 + gap / 2;
    for (const item of rowItems) {
      const cellCenterX = runningX + item.width / 2;
      cells.push({
        index: idx++,
        rowIndex: r,
        baseX: cellCenterX,
        baseY: r * stepY + firstRowY,
        width: item.width,
        height: cellH,
        photoIndex: item.photoIndex,
        angle: hash(r * 31 + item.colIdx * 17 + 7) * Math.PI * 2,
        rotation: (hash(r * 5 + item.colIdx * 11 + 3) - 0.5) * 3.6,
        scale: 1 + (hash(r * 7 + item.colIdx * 13 + 5) - 0.5) * 0.05,
      });
      runningX += item.width + gap + extraPerGap;
    }
  }

  return { cells, tile: { width: tileW, height: tileH, rows } };
}
```

### Why these passes

- **Two passes** so every row can share the same `tileW`. Picking photos with varying widths means each row has a different natural width — without unification the horizontal wrap would visibly tear at the seam (one row offset by a few px from the next).
- **Anti-collision** (left + above) is the difference between "this looks like a wall" and "this looks like a hash collision". Without it the wall reads as a tiled pattern; with it every visible group looks intentionally varied.
- **The +2 of overflow** isn't needed — the wrap handles edges; rows fill to `targetTileW` which is already `3 × vw` wide on desktop.

A 1440 × 900 desktop viewport produces ~24 rows × ~30 cells = ~720 cells in the tile. Mobile (375 × 800) at scale 2.6 produces ~22 rows × ~10 cells = ~220 cells.

---

## 8. Animation loop (rAF tick)

Runs every frame. Reads from refs, writes inline `transform` and `opacity` directly on DOM elements (no React state per-frame).

```ts
function tick() {
  // ─── A. Per-row drift — only when no detail is open
  if (!expanded) {
    for (let r = 0; r < rowOffsets.length; r++) {
      rowOffsets[r] += rowDriftSpeed(r);
    }
  }

  // ─── B. Pan lerp toward target
  panOff.x += (panTarget.x - panOff.x) * PAN_LERP;
  panOff.y += (panTarget.y - panOff.y) * PAN_LERP;

  // ─── C. Update void position (in WORLD coords)
  if (expanded) {
    if (!pinned) {
      // Initial-open pan still in progress — detect settle, then flip to pinned
      const dx = panTarget.x - panOff.x;
      const dy = panTarget.y - panOff.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) pinned = true;
    }
    if (pinned) {
      // Pinned: void tracks viewport centre in world coords so the featured
      // (rendered at the fixed viewport centre below) shows whichever cell
      // is currently centred behind it. Cells around the centre get
      // displaced — the "hole" stays put while the wall slides on next/prev.
      voidWorld.x = vw / 2 - panOff.x;
      voidWorld.y = vh / 2 - panOff.y;
    }
  } else if (mouse.has) {
    // Cursor IS the void centre — lerp world target = cursor − panOff
    const tx = mouse.x - panOff.x;
    const ty = mouse.y - panOff.y;
    voidWorld.x += (tx - voidWorld.x) * VOID_LERP;
    voidWorld.y += (ty - voidWorld.y) * VOID_LERP;
  }

  // ─── D. Target radius: idle (no hover) < hover < expanded, * introEmerge
  let baseR: number;
  if (expanded)        baseR = isMobile ? VOID_RADIUS_EXPANDED_MOBILE : VOID_RADIUS_EXPANDED_DESKTOP;
  else if (hovering)   baseR = isMobile ? VOID_RADIUS_HOVER_MOBILE    : VOID_RADIUS_HOVER_DESKTOP;
  else                 baseR = isMobile ? VOID_RADIUS_IDLE_MOBILE     : VOID_RADIUS_IDLE_DESKTOP;
  targetRadius = baseR * introVoidEmerge;   // intro tween scales target from 0 to 1
  voidRadius += (targetRadius - voidRadius) * RADIUS_LERP;

  const R    = voidRadius;
  const SOFT = R * SOFT_PUSH_RATIO;
  const vX   = voidWorld.x;
  const vY   = voidWorld.y;

  // ─── E. Per-cell loop
  const entrance = introEntrance.current;       // 0 → 1 over 1.7s
  const halfDiag = Math.hypot(vw, vh) / 2;
  const revealActive = entrance < 1;
  const cullMargin = 240;

  let nearestIdx = featuredIdx;
  let nearestDist = Infinity;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const el = items[i];
    if (!el) continue;

    // Drift + tile wrap to nearest viewport copy
    const driftedX = cell.baseX + (rowOffsets[cell.rowIndex] ?? 0);
    const baseScreenX0 = driftedX + panOff.x;
    const baseScreenY0 = cell.baseY + panOff.y;
    const kX = Math.round((vw / 2 - baseScreenX0) / tileW);
    const kY = Math.round((vh / 2 - baseScreenY0) / tileH);
    const effectiveWorldX = driftedX + kX * tileW;
    const effectiveWorldY = cell.baseY + kY * tileH;

    const dx = effectiveWorldX - vX;
    const dy = effectiveWorldY - vY;
    const dist = Math.hypot(dx, dy);

    // Featured tracking — across ALL cells (visible + culled), correct after pan
    if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }

    // Cull cells well off-screen
    const baseScreenX = effectiveWorldX + panOff.x;
    const baseScreenY = effectiveWorldY + panOff.y;
    if (baseScreenX + cell.width < -cullMargin) continue;
    if (baseScreenX > vw + cullMargin) continue;
    if (baseScreenY + cell.height < -cullMargin) continue;
    if (baseScreenY > vh + cullMargin) continue;

    // Displacement
    let finalWorldX = effectiveWorldX;
    let finalWorldY = effectiveWorldY;
    let s = cell.scale;

    if (dist < SOFT) {
      // Push cells radially outward — quadratic falloff, NO opacity fade
      const t = 1 - dist / SOFT;
      const push = R * t * t;
      let dirX: number, dirY: number;
      if (dist < 0.5) {
        // Cell sitting exactly at the void centre — use its hashed angle
        dirX = Math.cos(cell.angle);
        dirY = Math.sin(cell.angle);
      } else {
        dirX = dx / dist;
        dirY = dy / dist;
      }
      finalWorldX = effectiveWorldX + dirX * push;
      finalWorldY = effectiveWorldY + dirY * push;
      // Subtle ring scale boost — cells right at the boundary breathe forward
      if (dist > R * 0.55 && dist < R * 1.05) {
        const ringT =
          smoothstep(R * 0.55, R * 0.8, dist) *
          (1 - smoothstep(R * 0.85, R * 1.05, dist));
        s *= 1 + 0.06 * ringT;
      }
    }

    // Intro fly-in + opacity + scale wave (see §10)
    let alpha = 1;
    let introOffsetX = 0;
    let introOffsetY = 0;
    if (revealActive) {
      const distFromCenter = Math.hypot(cell.baseX, cell.baseY);
      const cellEntrance = entrance * 1.0 - (distFromCenter / halfDiag) * 0.4;
      const entranceAlpha = Math.max(0, Math.min(1, cellEntrance * 1.5));
      alpha = entranceAlpha;
      s *= 0.3 + 0.7 * entranceAlpha;
      if (distFromCenter > 1) {
        const dirX = cell.baseX / distFromCenter;
        const dirY = cell.baseY / distFromCenter;
        const flyMag = (1 - entranceAlpha) * 420;
        introOffsetX = dirX * flyMag;
        introOffsetY = dirY * flyMag;
      }
    }

    const screenX = finalWorldX + introOffsetX + panOff.x - cell.width / 2;
    const screenY = finalWorldY + introOffsetY + panOff.y - cell.height / 2;
    el.style.transform =
      `translate3d(${screenX.toFixed(2)}px, ${screenY.toFixed(2)}px, 0) ` +
      `rotate(${cell.rotation.toFixed(2)}deg) scale(${s.toFixed(3)})`;
    el.style.opacity = alpha < 0.999 ? alpha.toFixed(3) : "1";
  }

  // ─── F. Update featured index if a closer cell is now nearest
  if (nearestIdx !== featuredIdx && nearestDist < R * 0.9 && !expanded) {
    featuredIdx = nearestIdx;
    setFeaturedIdx(nearestIdx);   // React state — only ever fires on change
  }

  // ─── G. Position featured anchor
  if (anchor) {
    let sx: number, sy: number;
    if (expanded && pinned) {
      // Pinned: render featured at FIXED viewport centre. Only the wall
      // slides on next/prev; the image itself never moves.
      sx = vw / 2;
      sy = vh / 2;
    } else {
      sx = vX + panOff.x;
      sy = vY + panOff.y;
    }
    const fEm = introFeaturedEmerge;   // 0 → 1 with back.out
    anchor.style.transform =
      `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) scale(${fEm.toFixed(3)})`;
    anchor.style.opacity = fEm < 0.999 ? fEm.toFixed(3) : "1";
  }

  requestAnimationFrame(tick);
}
```

### Key invariants

- **Cell positions are in world coords; rendering converts via `+ panOff`.** The wrap math (`kX`, `kY`) brings each cell to its viewport-nearest copy so all 700+ cells render at most one copy of themselves at any moment.
- **Displacement is in world coords too.** `dist = |cell − voidWorld|` is the same number whether you compute it in world or screen (the offsets cancel), so the displaced ring is always perfectly centred on the void wherever it sits.
- **`featuredIdx` updates fire `setState` only on actual change.** With 700+ cells and a 60 fps loop, the nearest cell changes a few times a second under cursor motion, never per-frame.
- **`expandedRef` (or `expanded` mirror) guards both the drift increment and the featured-tracking `setState`.** When the detail is open, the wall freezes and the featured is locked.

---

## 9. Input handlers

```ts
// Mouse
window.addEventListener("pointermove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.has = true;
  // Fade out the "Move · Click to open" hint on first move
  if (!hasInteracted) hasInteracted = true;
});

// Touch (mobile)
window.addEventListener("touchmove", (e) => {
  if (e.touches.length === 0) return;
  mouse.x = e.touches[0].clientX;
  mouse.y = e.touches[0].clientY;
  mouse.has = true;
  if (!hasInteracted) hasInteracted = true;
}, { passive: true });   // passive so page scroll past the section still works

// Hover detection on the section (drives void radius idle → hover)
section.addEventListener("pointerenter", () => { hovering = true; });
section.addEventListener("pointerleave", () => { hovering = false; });
// hovering defaults to TRUE — page-load intro grows the void to hover size
// (matches what the user sees once they're actually on the section)

// Keyboard while detail is open
window.addEventListener("keydown", (e) => {
  if (!expanded || e.repeat) return;
  if (e.key === "Escape")         close();
  else if (e.key === "ArrowRight") next();
  else if (e.key === "ArrowLeft")  prev();
});
```

---

## 10. Cinematic intro (page-load entrance)

A single GSAP timeline, all waves overlap so the user never sees a "wait then next" beat. Total runtime ≈ 2.5 s.

```ts
const tl = gsap.timeline({ delay: 0.1 });

// Wave 1 — wall crystallises. The entrance scalar (0→1) drives per-cell
// alpha, scale and fly-in offset; see the tick loop §8.E. power2.inOut
// glides the radial wave through the wall instead of wiping it.
tl.to(introEntrance, { current: 1, duration: 1.7, ease: "power2.inOut" }, 0);

// Wave 2 — gravity void opens. Starts 0.2 s into the entrance so the user
// sees the void growing WITH the wall, not after it. power2.out so the
// emergence feels exactly like a slow mouse-hover at the centre.
tl.to(introVoidEmerge, { current: 1, duration: 1.1, ease: "power2.out" }, 0.2);

// Wave 3 — featured photo lands in the opening void. Slight back.out for a
// confident punch rather than a soft fade.
tl.to(introFeaturedEmerge, { current: 1, duration: 0.8, ease: "back.out(1.4)" }, 0.7);

// Hero copy cascades over the second half (still overlapping the wall's
// edge cells emerging) so the whole reveal feels like one continuous beat.
tl.to(eyebrowRef, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out" }, 1.1);
tl.to(titleChars, {
  opacity: 1, y: 0, scale: 1, filter: "blur(0px)",
  duration: 0.9, ease: "power4.out", stagger: 0.04,
}, 1.25);
tl.to(subRef,  { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out" }, 1.6);
tl.to(hintRef, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out" }, 1.7);
```

### Initial state (set before the timeline)

- `voidRadius = 0`, `targetRadius = 0` (so the void *grows* from nothing instead of shrinking from idle)
- `introEntrance.current = 0`
- `introVoidEmerge.current = 0`
- `introFeaturedEmerge.current = 0`
- Hero copy + chars: `{ opacity: 0, y: 18 (or 22 for chars), filter: blur(8/10px), scale: 0.8 (chars only) }`

### Per-cell intro math (inside §8.E)

```ts
const distFromCenter = Math.hypot(cell.baseX, cell.baseY);
const cellEntrance   = entrance * 1.0 - (distFromCenter / halfDiag) * 0.4;
const entranceAlpha  = Math.max(0, Math.min(1, cellEntrance * 1.5));

// Opacity wave (radial from centre)
alpha *= entranceAlpha;
// Scale pop — cells punch from 30% to 100% as the wave reaches them
s *= 0.3 + 0.7 * entranceAlpha;
// Radial fly-in — each cell starts pushed OUTWARD 420 px along its
// grid-position direction and rushes inward as it emerges
if (distFromCenter > 1) {
  const dirX = cell.baseX / distFromCenter;
  const dirY = cell.baseY / distFromCenter;
  const flyMag = (1 - entranceAlpha) * 420;
  introOffsetX = dirX * flyMag;
  introOffsetY = dirY * flyMag;
}
```

### Featured pop (anchor transform)

`anchor.style.transform = translate3d(sx, sy, 0) scale(introFeaturedEmerge)` and `opacity = introFeaturedEmerge`. The `back.out(1.4)` ease provides a confident overshoot at peak (~1.1 scale) before settling at 1.

---

## 11. Click → camera pan (open detail)

```ts
function onFeaturedClick() {
  if (expanded) return;
  // Initial-open pan: voidWorld stays at the click point; panTarget puts
  // that world point at the viewport centre. featuredAnchor renders at
  // (voidWorld + panOff) — it slides smoothly from cursor to centre as
  // the pan lerps. pinnedRef stays false until the pan settles.
  pinned = false;
  panTarget.x = vw / 2 - voidWorld.x;
  panTarget.y = vh / 2 - voidWorld.y;
  setExpanded(true);
}
```

The tick (§8.C) flips `pinned` to `true` when `|panTarget − panOff| < 0.5`. From that moment on, the featured anchor is rendered at the fixed `(vw/2, vh/2)` and `voidWorld` is rewritten each frame to `(vw/2 − panOff.x, vh/2 − panOff.y)`. The settled position has `voidWorld = clickPoint`, so the transition between the two modes is invisible.

### Why pinning matters

Without pinning, prev/next clicks would also move the featured anchor (because anchor = voidWorld + panOff and panOff changes during the pan). Pinning makes the featured image render at a *fixed viewport coordinate* — only the wall slides behind it.

---

## 12. Prev / Next navigation

```ts
function navigate(dir: 1 | -1) {
  const newIdx = (featuredIdx + dir + cells.length) % cells.length;
  const next = cells[newIdx];

  // Use the same drift + wrap math the render loop uses, so the new cell's
  // world position is wherever the user currently SEES it on screen.
  const driftedX = next.baseX + (rowOffsets[next.rowIndex] ?? 0);
  const baseScreenX0 = driftedX + panOff.x;
  const baseScreenY0 = next.baseY + panOff.y;
  const kX = Math.round((vw / 2 - baseScreenX0) / tile.width);
  const kY = Math.round((vh / 2 - baseScreenY0) / tile.height);
  const nextWorldX = driftedX + kX * tile.width;
  const nextWorldY = next.baseY + kY * tile.height;

  // Force pinned — featured DOES NOT move on next/prev; only the wall slides.
  pinned = true;
  panTarget.x = vw / 2 - nextWorldX;
  panTarget.y = vh / 2 - nextWorldY;
  // Do NOT touch voidWorld — the pinned tick rule keeps it synced with
  // viewport centre as the pan lerps, so the displacement zone slides
  // with the wall and the featured display swaps content cleanly.
  featuredIdx = newIdx;
  setFeaturedIdx(newIdx);
}

const onNext = () => navigate( 1);
const onPrev = () => navigate(-1);
```

---

## 13. Featured card layout

The featured card lives inside the *featured anchor* (a 0-sized div positioned at the void centre every frame). The card itself uses `transform: translate(-50%, -50%)` so its centre is always at the anchor, regardless of width / height.

### Frame dims

```ts
const restH    = isMobile ? 220 : 280;
const restMaxW = isMobile ? 270 : 400;
const expH     = isMobile ? 280 : 360;
const expMaxW  = isMobile ? 300 : 480;
// Min frame width when expanded — guarantees Order print + Inquire stay
// on one line even for narrow portrait photos
const expMinW  = isMobile ? 260 : 340;

const h    = expanded ? expH : restH;
const maxW = expanded ? expMaxW : restMaxW;
let w      = h * aspect;
let frameH = h;
if (w > maxW) { w = maxW; frameH = maxW / aspect; }
else if (expanded && w < expMinW) { w = expMinW; frameH = expMinW / aspect; }
```

### Frame style

```css
position: absolute;
width:  <w>px;
height: <frameH>px;
transform: translate(-50%, -50%);
transition:
  width  0.25s cubic-bezier(0.16, 1, 0.3, 1),
  height 0.25s cubic-bezier(0.16, 1, 0.3, 1);
```

The short 0.25 s transition lets the frame settle to a new photo's aspect on prev/next without a visible morph window. Faster than the pan, so by the time the wall is done moving the frame is already in its new shape.

### Image element

```html
<div class="image-wrapper">
  <img src="<featuredUrl(id, aspect)>" alt="<title>" draggable="false" />
  <div class="rest-caption" v-if="!expanded">…</div>
</div>
```

```css
.image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
  background-color: #000;   /* black placeholder while the next photo loads */
  box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.7);
}
.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

**Single src across rest + expanded states.** No `key` on the `<img>`. The element stays mounted; src only changes when the photo changes (prev/next or natural drift). Browsers hold the painted pixels while a new src loads, so the zoom transition has no blank frame.

### Rest caption strip

A bottom gradient inside the image wrapper, shown ONLY when `!expanded`:

```css
position: absolute;
bottom: 0; left: 0; right: 0;
padding: 12px;
background: linear-gradient(to top,
  rgba(0,0,0,0.85) 0%,
  rgba(0,0,0,0.40) 50%,
  transparent 100%);
color: #ffffff;
```

Content: category (10 px uppercase tracking-0.22em opacity-75) over title (Playfair Display 16 px, truncated to one line).

### Expanded layout

```
        ┌─────────────┐
        │ [<]   [>]   │   ← arrows (small, 32×32, side by side)
        │  CATEGORY   │   ← 10 px uppercase tracking-0.24em
        │   Title     │   ← Playfair Display, 24–30 px
        └─────────────┘
[♥]                    [↗]
[⌑]   ┌─────────────┐  [↓]
      │             │  [×]
      │   IMAGE     │
      │             │
      └─────────────┘
        LOCATION · YEAR     ← 11 px uppercase tracking-0.24em
        Description text…   ← desktop only, 13 px max-w 440 px
        [Order print] [Inquire]
```

- **Title block** — `absolute bottom-full mb-4`. Arrow row first (centered, gap-3), category second, title third.
- **Left side icon stack** (desktop only) — `absolute right-full top-1/2 -translate-y-1/2 mr-4 flex-col gap-2`. Icons: **Like**, **Save**.
- **Right side icon stack** (desktop only) — `absolute left-full top-1/2 -translate-y-1/2 ml-4 flex-col gap-2`. Icons: **Share**, **Download**, **Close**.
- **Mobile icon row** — when `isMobile && expanded`, all 5 icons appear in a horizontal row inside the below block (Like, Save, Share, Download, Close).
- **Below block** — `absolute top-full mt-4`, `text-center`, `min-width: 320 (260 mobile)`. Order: location · year strip, mobile icon row (if mobile), description (desktop only), buttons row.
- **Description hidden on mobile** so the expanded card stays compact within the smaller viewport.

### Icons (inline SVG, 16 × 16, stroke-only, currentColor)

```html
<!-- Like -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
</svg>

<!-- Save -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
</svg>

<!-- Share -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
  <polyline points="16 6 12 2 8 6"/>
  <line x1="12" y1="2" x2="12" y2="15"/>
</svg>

<!-- Download -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/>
  <line x1="12" y1="15" x2="12" y2="3"/>
</svg>

<!-- Close (14 × 14, slightly larger stroke) -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <path d="M6 6 L18 18 M18 6 L6 18"/>
</svg>

<!-- Prev / Next arrows (13 × 13, in the title row) -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="15 18 9 12 15 6"/>   <!-- prev -->
  <polyline points="9 18 15 12 9 6"/>    <!-- next -->
</svg>
```

### Icon button styling

```css
width: 36px; height: 36px;        /* arrows in title row are 32px */
display: flex; align-items: center; justify-content: center;
border-radius: 9999px;
backdrop-filter: blur(12px);
background:   rgb(var(--foreground-rgb) / 0.10);
color:        rgb(var(--foreground-rgb) / 0.85);
border:       1px solid rgb(var(--foreground-rgb) / 0.10);
transition: background 0.2s, color 0.2s;
```

Hover: `background: rgb(var(--foreground-rgb) / 0.20)`, `color: rgb(var(--foreground-rgb) / 1)`.

### Buttons

```css
/* Order print — primary */
padding: 12px 24px;
border-radius: 9999px;
background: var(--foreground);
color:      var(--background);
font-size: 14px; font-weight: 500;
white-space: nowrap;
box-shadow: 0 4px 12px rgba(0,0,0,0.15);

/* Inquire — secondary */
padding: 12px 24px;
border-radius: 9999px;
backdrop-filter: blur(12px);
background:   rgb(var(--foreground-rgb) / 0.08);
color:        rgb(var(--foreground-rgb) / 0.90);
border:       1px solid rgb(var(--foreground-rgb) / 0.15);
font-size: 14px; font-weight: 500;
white-space: nowrap;
```

Both have `:hover { opacity: 0.9 }` (primary) and `:hover { background: rgb(var(--foreground-rgb) / 0.15) }` (secondary).

### Close paths

Three ways to close the expanded view:
1. **Close icon** in the right-side stack (desktop) or the icon row (mobile)
2. **`Escape`** key (ignores `e.repeat`)
3. **Backdrop click** — the dim overlay sits at `z-20` and forwards `onClick` to `close`

On close: `pinned = false`, `expanded = false`. Pan stays where it is (the user is now exploring a new area of the wall). The void resumes lerping toward `cursor − panOff`, so the featured card glides from viewport centre back to under wherever the cursor sits.

---

## 14. Hero copy (bottom-left)

```html
<div class="hero">
  <div class="eyebrow">
    <span class="hr"></span>
    A photography wall
  </div>
  <h1 class="title">
    <span data-char>M</span><span data-char>o</span><span data-char>m</span>
    <span data-char>e</span><span data-char>n</span><span data-char>t</span>
    <span data-char>s</span>
  </h1>
  <p class="sub">The wall parts wherever your cursor goes. Click to centre the moment.</p>
</div>
```

```css
.hero {
  position: absolute;
  bottom: 28px; left: 28px;
  z-index: 35;                  /* ABOVE the featured (z-30) */
  max-width: 28rem;
  pointer-events: none;
  color: var(--foreground);
}
.hero .eyebrow {
  display: flex; align-items: center; gap: 12px;
  font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.22em;
  color: rgb(var(--foreground-rgb) / 0.65);
}
.hero .hr {
  width: 32px; height: 1px;
  background: rgb(var(--foreground-rgb) / 0.45);
}
.hero .title {
  margin-top: 12px;
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(2.25rem, 4vw, 3.75rem);  /* 4xl → 6xl */
  line-height: 0.95;
  letter-spacing: -0.02em;
}
.hero .title [data-char] {
  display: inline-block;
  white-space: pre;
  will-change: transform;
  opacity: 0;                   /* hidden until GSAP shows them */
}
.hero .sub {
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: rgb(var(--foreground-rgb) / 0.60);
  max-width: 20rem;
  /* Hide on mobile while detail open — see Mobile §16 */
}
@media (max-width: 767px) { .hero .sub { display: none; } }
```

### Hero gradient backdrop (`z-14`)

Sits BELOW the dim overlay so the expanded state cleanly tints both together.

```html
<div class="hero-gradient" aria-hidden></div>
```

```css
.hero-gradient {
  position: absolute; inset: 0;
  z-index: 14;
  pointer-events: none;
  background: radial-gradient(
    ellipse 70% 55% at 0% 100%,
    rgb(var(--background-rgb) / 1)    0%,
    rgb(var(--background-rgb) / 0.85) 22%,
    rgb(var(--background-rgb) / 0.55) 40%,
    rgb(var(--background-rgb) / 0.25) 58%,
    transparent                       78%
  );
}
```

The gradient is theme-aware (uses `--background-rgb`), and sized just large enough to keep the hero text legible against any photo behind it.

### Hide the hero when detail is open on mobile

```ts
<div className={`hero ${expanded && isMobile ? "hidden" : ""}`}>
```

Mobile expanded view has the whole viewport to itself; the hero copy is brought back the moment the detail closes.

---

## 15. Interaction hint (top-right)

```html
<div class="hint" ref={hintRef}>Move &middot; Click to open</div>
```

```css
.hint {
  position: absolute;
  top: 28px; right: 28px;
  z-index: 40;
  pointer-events: none;
  font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.22em;
  color: rgb(var(--foreground-rgb) / 0.55);
  transition: opacity 0.7s;
}
```

Opacity bound to a `hasInteracted` flag; flipped to `1` (via inline style) the moment the first `pointermove` / `touchmove` fires, fading the hint out.

---

## 16. Theme awareness

Two CSS variables drive every theme-aware colour in the section. Add to your global stylesheet (or equivalent):

```css
:root,
[data-theme="light"] {
  --background: #fafafa;
  --foreground: #0a0a0a;
  --background-rgb: 250 250 250;   /* space-separated RGB for use in rgb(... / alpha) */
  --foreground-rgb: 10 10 10;
}

[data-theme="dark"] {
  --background: #0a0a0a;
  --foreground: #fafafa;
  --background-rgb: 10 10 10;
  --foreground-rgb: 250 250 250;
}
```

The section uses:
- **Section background** — `background: var(--background)`
- **Hero text / hint** — `color: rgb(var(--foreground-rgb) / N)`
- **Hero gradient** — `rgb(var(--background-rgb) / N)` for the radial stops
- **Detail dim overlay** — `rgb(var(--background-rgb) / 0.55)`
- **Detail text / icons / buttons** — `rgb(var(--foreground-rgb) / N)` / `var(--foreground)` / `var(--background)`
- **Photo wall is theme-independent** — photos render as-is on whatever background is current.

Switching `data-theme` between `light` and `dark` flips everything in one CSS update; the section never needs to re-render. The dim overlay washes the wall light in light theme and dark in dark theme; matching foreground text is always readable.

---

## 17. Mobile adaptations (`vw < 768`)

| Feature                  | Desktop                        | Mobile                                |
|--------------------------|--------------------------------|---------------------------------------|
| Cell row height          | 100                            | 72                                    |
| Cell gap                 | 12                             | 8                                     |
| Tile scale               | 3                              | 2.6                                   |
| Void idle radius         | 200                            | 130                                   |
| Void hover radius        | 280                            | 180                                   |
| Void expanded radius     | 420                            | 280                                   |
| Featured H (rest / exp.) | 280 / 360                      | 220 / 280                             |
| Featured max-W (r / e)   | 400 / 480                      | 270 / 300                             |
| Featured min-W (exp.)    | 340                            | 260                                   |
| Hero subtitle            | visible                        | `display: none`                       |
| Description in detail    | visible                        | hidden                                |
| Hero block when expanded | visible                        | hidden                                |
| Side icon stacks         | visible (left + right of img)  | hidden — replaced by row below image  |
| Touch                    | `pointermove`                  | `pointermove` + `touchmove` (passive) |

### Mobile browser chrome resize filter

iOS Safari and Android Chrome hide / show the URL bar on scroll, which fires `window` resize events with a vh change of 60–150 px. Re-running `buildCells` for those changes rebuilds the whole wall and looks like a glitch. **Filter the resize:**

```ts
function update() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw < 768;
  setDims((prev) => {
    if (!prev) return { vw, vh, isMobile };
    if (prev.vw === vw && prev.isMobile === isMobile && Math.abs(prev.vh - vh) < 200) {
      return prev;   // ignore mobile-chrome-only changes
    }
    return { vw, vh, isMobile };
  });
}
window.addEventListener("resize", update);
update();
```

Width changes and large vh jumps (orientation flip > 200 px) still pass and trigger a clean rebuild.

---

## 18. Section root styling

```css
section.moments {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--background);
  isolation: isolate;       /* contains z-index stack */
  user-select: none;
}
```

### Cell styling

```css
.cell {
  position: absolute;
  top: 0; left: 0;
  pointer-events: none;     /* the wall doesn't intercept clicks */
  will-change: transform;
  overflow: hidden;
  border-radius: 3px;
  transform-origin: center center;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  opacity: 0;               /* initial — the tick writes opacity on first frame */
}
.cell img {
  width: 100%; height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}
```

### Featured anchor + frame

```css
.featured-anchor {
  position: absolute;
  top: 0; left: 0;
  z-index: 30;
  pointer-events: none;
  will-change: transform;
  opacity: 0;               /* GSAP / intro tick takes over */
}
.featured-anchor .frame {
  position: absolute;
  pointer-events: auto;
  /* width, height, transition set per-frame from FeaturedCard component */
}
```

---

## 19. Entrance / interaction full timing reference

| Tween / event                          | Start (s) | Duration (s) | Ease              | Target                          |
|----------------------------------------|-----------|--------------|-------------------|---------------------------------|
| Intro delay                            | —         | 0.10         | —                 | timeline start                  |
| Wall entrance (`introEntrance`)        | 0.00      | 1.70         | `power2.inOut`    | scalar 0 → 1                    |
| Void emerge (`introVoidEmerge`)        | 0.20      | 1.10         | `power2.out`      | scalar 0 → 1 (radius multiplier)|
| Featured pop (`introFeaturedEmerge`)   | 0.70      | 0.80         | `back.out(1.4)`   | scalar 0 → 1 (scale + opacity)  |
| Eyebrow                                | 1.10      | 0.70         | `power3.out`      | `opacity 0→1, y 18→0, blur 8→0` |
| Title chars (stagger 0.04)             | 1.25      | 0.90         | `power4.out`      | `opacity 0→1, y 22→0, scale 0.8→1, blur 10→0` |
| Subtitle                               | 1.60      | 0.70         | `power3.out`      | `opacity 0→1, y 18→0, blur 8→0` |
| Hint                                   | 1.70      | 0.70         | `power3.out`      | `opacity 0→1, y 18→0, blur 8→0` |
| Cursor follow                          | always    | per-frame    | lerp 0.25         | `voidWorld` toward cursor       |
| Hover radius transition                | always    | per-frame    | lerp 0.07         | `voidRadius` toward target      |
| Pan after click                        | on click  | per-frame    | lerp 0.07         | `panOff` toward target          |
| Featured frame size                    | on change | 0.25         | cubic-bezier(0.16, 1, 0.3, 1) | `width`, `height`     |
| Hint fade-out                          | on first move | 0.70     | `transition`      | `opacity → 0`                   |

---

## 20. Quality checklist

- [ ] Wall is INFINITE — per-cell `(kX, kY)` chosen each frame via `Math.round((vw/2 − (driftedX + panX)) / tileW)` so cells appear at their viewport-nearest copy. No edge ever visible regardless of how many times the user clicks toward one direction.
- [ ] Even-row tile width — every row's natural width measured in pass 1, the largest becomes `tileW`, shorter rows distribute the extra space as widened gaps. Horizontal seam is clean.
- [ ] Anti-collision — no two adjacent cells (left + above) ever share the same photo. The wall reads as a genuine mosaic.
- [ ] Variable-width cells — each cell's width = `cellH × photo.aspect`. Landscapes wide, portraits narrow, squares square.
- [ ] Three-stage void radius — idle (cursor outside) < hover (cursor inside) < expanded (detail open). `hoveringRef` defaults to `true` so the page-load intro grows directly to hover size.
- [ ] Cursor IS the void — `voidWorld` lerps toward `cursor − panOff` at `VOID_LERP = 0.25`. No comfort zone, no chase ramp.
- [ ] Cells inside the void are pushed radially with quadratic falloff, **never faded**. The void is a pure displacement effect.
- [ ] Subtle ring scale boost at the void boundary (≤ 1.06×) — gives the perimeter a slight forward "breath".
- [ ] Per-row drift — adjacent rows go opposite directions at hashed speeds (0.05–0.23 px/frame). Frozen while expanded.
- [ ] Featured tracking iterates ALL cells (not just visible) so the pick is correct even after many click-pans have moved `voidWorld` far from world origin. Fires `setState` only on actual change AND when `nearestDist < R * 0.9` AND `!expanded`.
- [ ] Click opens detail with `pinned = false` so the featured slides from cursor to centre with the pan. Pinning flips automatically on settle (math arranged so the transition is invisible).
- [ ] Prev / Next forces `pinned = true` — featured is rendered at fixed `(vw/2, vh/2)`, only the wall slides. No image movement during navigate.
- [ ] Featured frame size transitions over 0.25 s — snappy enough that prev/next swaps don't morph noticeably; slow enough that open/close looks smooth.
- [ ] Featured `<img>` element stays mounted across rest/expanded — no `key`, single `src` (`featuredUrl(id, aspect)`). Browser holds painted pixels during src change.
- [ ] Image wrapper has `background: #000` — when the next photo is uncached the frame shows a clean dark placeholder rather than the wall bleeding through.
- [ ] Cinematic intro choreographs four overlapping waves over ~2.5 s: cells crystallise (radial wave + scale + fly-in), void opens (matched to a real mouse-hover), featured pops (back.out), hero copy cascades.
- [ ] Cells render with `opacity: 0` in their initial inline style so the first frame doesn't flash before the intro tick writes opacity.
- [ ] Hero copy spans have `opacity: 0` in initial JSX (same reason).
- [ ] Theme-aware via `--background-rgb` and `--foreground-rgb` triplets — overlay, text, icons, buttons all swap on `[data-theme]` change without re-rendering.
- [ ] Hero `z-35` ABOVE featured `z-30` so the floating featured never covers "Moments" when the cursor wanders into the bottom-left.
- [ ] Hero hidden on mobile while detail open (`expanded && isMobile`).
- [ ] Mobile chrome resize filter — vh-only changes < 200 px ignored so iOS / Android URL-bar collapse doesn't rebuild the wall on scroll.
- [ ] Touch listeners use `{ passive: true }` so the page can still scroll past the section.
- [ ] ESC closes; backdrop click closes; ArrowLeft / ArrowRight navigate (all gated on `expanded`, all ignore `e.repeat`).
- [ ] No emojis or unicode glyphs anywhere — every icon is an inline SVG.
- [ ] `Math.random()` is never called. Every per-cell value is hashed from `(row, col-within-row)` so the wall is deterministic and resize-stable.

---

## 21. External assets

- **Fonts** — Geist Sans (body, optional — the section will work with any system sans), Playfair Display (display, for the "Moments" title and the featured photo titles). Load via Google Fonts or self-host:
  - Playfair Display: `https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;700&display=swap`
- **GSAP** — Used for the intro timeline only (cell physics and the rAF loop are framework-free). Load from CDN:
  - `https://unpkg.com/gsap@3/dist/gsap.min.js`
- **Unsplash images** — All photos load via `https://images.unsplash.com/photo-{id}?w=…&h=…&fit=crop&q=…&auto=format`. No API key required; Unsplash's image CDN serves these directly. Image IDs are listed in the §6 photo set.

That's the entire dependency surface. No fonts beyond Playfair, no JS libraries beyond GSAP, no API tokens.
