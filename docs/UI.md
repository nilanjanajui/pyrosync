# PyroSync UI Design Specification & Design Tokens

## 1. Information Architecture
PyroSync is designed for non-experts, emergency responders, journalists, and curious citizens to explore California wildfire activity without scientific jargon.

### Layout Model (Desktop: One Screen, Zero Vertical Page Scroll)
```text
┌────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: PyroSync · California wildfire activity from satellites       │
│ [How it works] [Download CSV]                                          │
├──────────────────────────────────────┬─────────────────────────────────┤
│ LEFT PANEL (~65% width)              │ RIGHT PANEL (~35% width)        │
│                                      │                                 │
│ [All CA] [North] [Central] [South]   │ Plain-Language Summary:         │
│ [Draw an area]                       │ "In August 2020, satellites     │
│                                      │  detected 412 fire hotspots..." │
│ Large Map (10 km Cividis Choropleth) │                                 │
│                                      │ Which months were busiest?      │
│                                      │ (Year × Month Cividis Grid)     │
│ Timeline Slider:                     │ 4 Classes: Quiet, Moderate,     │
│ [Play/Pause] [Month]                 │ Busy, Very Busy + Estimated Hatched
│ Estimated before 2012 | Measured 2012│ Reliability Badge & Error       │
│                                      │ [Download this area as CSV]     │
├──────────────────────────────────────┴─────────────────────────────────┤
│ FOOTER: NASA FIRMS archive · Record ends 2021-12 · Detection semantics │
└────────────────────────────────────────────────────────────────────────┘
```
- **Mobile (<768px)**: Responsive stacked layout where map appears on top and the right panel acts as a scrollable bottom sheet.

---

## 2. Design Tokens

### Color Palette (WCAG 2.2 AA Compliant)
| Token Name | Value | Purpose |
| :--- | :--- | :--- |
| `app.bg` | `#0B1014` | Deep slate page shell |
| `app.surface1` | `#11181E` | Primary cards and panels |
| `app.surface2` | `#151E25` | Secondary elevated surface & chips |
| `app.elevated` | `#1A252D` | Hover & interactive state |
| `app.border` | `#1E2B35` | Low-contrast cool border ($\ge 3:1$) |
| `app.text` | `#F0F4F8` | High-contrast body text ($\ge 4.5:1$) |
| `app.textMuted` | `#8C9BAE` | Secondary guidance text ($\ge 4.5:1$) |
| `app.textSubdued` | `#5A6B7C` | Subdued metadata and scales |
| `accent.amber` | `#F59E0B` | Primary interactive amber focus and selected area stroke |

### Cividis Sequential Palette (Colorblind-Safe)
Cividis is the default and primary palette for all choropleth cells and heatmap calendars:
- **Zero / Baseline**: `#1E293B` (Slate-800)
- **Quiet**: `#00204D` (Dark Navy)
- **Moderate**: `#414D6B` (Mid Slate-Blue)
- **Busy**: `#8A8B79` (Warm Olive Khaki)
- **Very Busy**: `#FFEA46` (Bright Cividis Yellow)

### Visual Provenance Pattern
- **Measured (2012–2021)**: Solid fill + `Measured by satellite` badge.
- **Estimated (2000–2012)**: 45° diagonal hatch pattern (`bg-hatched`) + `Estimated from an older satellite` badge. Never differentiated by color alone.

---

## 3. Typography & Hierarchy
- **Primary Typeface**: Inter / System UI sans-serif.
- **Base Body Text**: 16px (`text-base`).
- **Minimum Text Size**: 13px (`text-xs`), with micro-labels at 11px only for compact axis ticks.
- **Tabular Numerals**: Monospace used strictly for data digits (`tabular-nums`).

---

## 4. Accessibility & Copy Principles
- **Reading Level**: High-school reading level.
- **Banned Main UI Jargon**: `harmonized`, `normalization`, `LOYO`, `WAPE`, `bias`, `quantile`, `FRP`, `provisional`, `VIIRS-equivalent`.
- **Glossary Hotspot Detection**: "One satellite pixel flagged as burning. It is not the same as one fire."
- **Touch Target Size**: Minimum 44px on all buttons, chips, and slider controls.
- **Automated Audit**: Audited with `@axe-core/playwright` with 0 critical or serious violations.

