# PyroSync Accessibility Architecture & Decisions (WCAG 2.2 AA)

PyroSync is designed from the ground up to comply strictly with the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA requirements.

---

## 1. Visual Presentation & Color Inclusivity

- **No Meaning by Color Alone**: Every state (zero detections, unoperated period, unusual high, unusual low, partial month, blend boundary) is communicated via multiple modalities:
  1. High-contrast typography and explicit numeric counts.
  2. Textual badges (`Provisional`, `Validated`, `Native VIIRS`, `Scaled MODIS`).
  3. Pattern textures (e.g. hatched SVG diagonal pattern for unoperated/null months).
- **Perceptually Uniform Colorblind-Safe Palettes**:
  - **Sequential Ramp (Counts)**: `Cividis` palette (`d3-scale-chromatic`). Perceptually uniform across luminance and optimized specifically for deuteranomaly, protanomaly, and tritanomaly.
  - **Diverging Ramp (Anomalies & Percentiles)**: Purple-Orange (`PuOr`, `d3-scale-chromatic`). Red-Green scales are strictly prohibited throughout the application.
  - **Zero Detections**: Distinct slate-700 neutral tone (`#334155`), ensuring a visual and conceptual distinction between "monitored zero fire" and "no data".
- **Contrast Ratios**:
  - Body text adheres to $\ge 4.5:1$ contrast against dark surfaces (`#f8fafc` text on `#0f172a` / `#1e293b`).
  - Interactive boundaries, icons, and focus outlines adhere to $\ge 3:1$ contrast.

---

## 2. Keyboard Operability

- **Skip Navigation**: Accessible `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>` element at the top of the DOM.
- **Focus Rings**: High-contrast, non-interfering focus rings on all interactive elements: `outline: 2px solid #f97316; outline-offset: 2px`.
- **Burn Calendar Grid**:
  - Implements a real ARIA grid pattern: `role="grid"`, `aria-rowindex`, `aria-colindex`.
  - Arrow key navigation (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`).
  - `Home` navigates to January; `End` navigates to December.
  - `Enter` and `Space` activate the focused month detail inspector.
- **Mouse-Free Spatial AOI Definition**:
  - Users with motor impairments who cannot use pointer/mouse drawing tools can enter explicit coordinate bounding boxes (`[minLon, minLat, maxLon, maxLat]`) or center point coordinates and radius through standard HTML form controls with validation feedback.

---

## 3. Screen Readers & Assistive Technology

- **Live Announcements**: Persistent `aria-live="polite"` region broadcasts updates whenever an AOI is defined/cleared, date ranges change, or sensor mode is switched.
- **Accessible Table Alternatives**: Every data chart (seasonal profile, rankings, sensor comparison) has an equivalent accessible HTML `<table />` view with semantic header associations.
- **Clear Error Boundaries**: If dataset validation fails, `ErrorScreen` provides an accessible, non-dismissible heading with exact file and field descriptions.

---

## 4. Motion & Animation

- `@media (prefers-reduced-motion: reduce)` globally disables map flyTo transitions and UI animations, instantly rendering new states for vestibular-sensitive users.

