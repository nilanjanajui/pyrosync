/**
 * PyroSync User-Facing Copy
 * All text visible to the user lives here.
 * Written at a high-school reading level.
 *
 * Rules:
 * - NO banned jargon in main UI: harmonized, normalization, LOYO, WAPE, bias, quantile, FRP, provisional, VIIRS-equivalent.
 * - NO developer instructions as UI copy (e.g. "do not center on point estimate").
 * - NO false claims (never claim validation against "ground fire perimeters").
 */

export const copy = {
  header: {
    title: 'PyroSync',
    tagline: (area: string) => `${area} · wildfire activity seen from satellites`,
    coverageChip: (start: string, end: string) => `${start} to ${end}`,
    regionLabel: 'Region',
    howItWorksButton: 'How it works',
    downloadButton: 'Download CSV',
  },

  demo: {
    badge: 'Demo data',
    message: 'Simulated test data. Not for operational fire management decisions.',
  },

  regions: {
    all: (area: string) => `All ${area}`,
    draw: 'Draw an area',
    drawingActive: 'Click and drag to draw an area',
    clearDraw: 'Clear custom area',
  },

  map: {
    title: 'Fire hotspot detections on 10 km grid',
    legendTitle: 'Hotspot detections',
    legendZero: '0 detections',
    legendSelectedAoi: 'Selected area',
    sliderEstimated: 'Estimated (older satellite)',
    sliderMeasured: 'Measured by modern satellite',
    play: 'Play timeline',
    pause: 'Pause timeline',
    stepBack: 'Previous month',
    stepForward: 'Next month',
    jumpToPeak: (monthLabel: string) => `Jump to busiest month: ${monthLabel}`,
    measuredFrom: (month: string) => `Measured from ${month}`,
    viewGlow: 'Fire glow & icons',
    viewGrid: 'Grid cells',
    layerDark: 'Dark canvas',
    layerSatellite: 'Satellite',
    searchPlaceholder: 'Search city, park, county, or coords (e.g. Yosemite, 37.8, -119.5)...',
    searchAriaLabel: 'Search location on map',
    clearSearch: 'Clear search',
    locationFound: (name: string) => `Showing fire activity near ${name}`,
    sensorDataset: 'Sensor Dataset',
    sensorHarmonized: 'Harmonized',
    sensorHarmonizedYears: '2000–2021',
    sensorHarmonizedDesc: 'Continuous 22-year calibrated record combining MODIS & VIIRS',
    sensorModis: 'MODIS',
    sensorModisYears: '2000–2021',
    sensorModisDesc: 'Raw 1 km MODIS active-fire detections (Terra & Aqua)',
    sensorViirs: 'VIIRS',
    sensorViirsYears: 'from 2012',
    sensorViirsDesc: 'Direct 375 m Suomi-NPP VIIRS observations (available from Feb 2012)',
  },

  summary: {
    noCoverage: (area: string) =>
      `No satellite data is loaded for this place. The current dataset covers ${area}. Move or redraw the area inside it.`,
    usualLabel: (month: string) => `Usual for ${month}`,
    cellsLabel: 'Area size',
    title: 'Area and month summary',
    detectionsLabel: 'Hotspot detections',
    percentileHigherThan: (pct: number, month: string, sinceYear: string) =>
      `higher than ${pct}% of ${month}s since ${sinceYear}`,
    vsUsualAbove: (pct: number) => `${pct}% above usual`,
    vsUsualBelow: (pct: number) => `${pct}% below usual`,
    vsUsualSame: 'About usual',
    vsUsualNone: 'No usual value yet',
    usualNote: 'Usual = median of the same month in all other years',
    typical: 'about typical',
    unusualHigh: 'much busier than usual',
    unusualLow: 'quieter than usual',
    sentence: (monthYear: string, count: number, monthName: string, typicality: string, pctText: string) =>
      `In ${monthYear}, satellites detected ${count.toLocaleString()} fire hotspots in your area. That is ${typicality} for ${monthName} (${pctText}).`,
  },

  calendar: {
    title: 'Which months were busiest?',
    subtitle: 'Each square is one month. Darker squares mean more fire hotspots were detected.',
    legendQuiet: 'Quiet',
    legendModerate: 'Moderate',
    legendBusy: 'Busy',
    legendVeryBusy: 'Very busy',
    legendEstimated: 'Estimated',
    modeCounts: 'Hotspot counts',
    modeAnomaly: 'Compared with usual',
    anomalySubtitle: 'Each square compares a month with the usual (median) for the same calendar month.',
    anomalyMuchLower: 'Much lower',
    anomalyLower: 'Lower',
    anomalyUsual: 'About usual',
    anomalyHigher: 'Higher',
    anomalyMuchHigher: 'Much higher',
    legendNoData: 'No data',
  },

  reliability: {
    measuredBadge: 'Measured by satellite',
    measuredTooltip: 'Direct observations recorded by the modern VIIRS 375-meter satellite sensor.',
    estimatedBadge: 'Estimated from older satellite',
    estimatedTooltip: 'Calculated from 1 km MODIS satellite records using seasonal scaling.',
    smallAreaWarning:
      'This area is small. Monthly numbers can be off by about a third. Try a larger area or yearly totals.',
    typicalErrorLabel: (errorPct: number) => `Typical error: about ±${errorPct}% across regions`,
  },

  download: {
    buttonLabel: 'Download this area as CSV',
    modalTitle: 'Download Monthly Detection Records',
    modalDescription:
      'Export the monthly detection count series for your selected area as a standard CSV file.',
    rangeTitle: 'Date range',
    rangeFrom: 'From',
    rangeTo: 'To',
    rangeReset: 'Full record',
    imageButton: 'Save calendar as image',
    coordsTitle: 'Enter coordinates instead',
  },

  drawer: {
    title: 'How PyroSync Works and Data Accuracy',
    closeButton: 'Close',
    paragraph1Title: 'How satellites see fires',
    paragraph1: (area: string) =>
      `Satellites scan ${area} from space day and night, picking up infrared heat from active burning. When a satellite pixel shows an unusual heat signature, it is recorded as a "fire hotspot detection." A detection is a satellite sighting of heat during an orbit—it is not the same as one single wildfire or the total acreage burned.`,
    paragraph2Title: 'Connecting two generations of satellites',
    paragraph2: (_startYear: string, years: number, viirsYear: string) =>
      `Until ${viirsYear}, the record relies on the MODIS instrument, which observes the earth in 1-kilometer grid boxes. From ${viirsYear}, the sharper VIIRS instrument operates with 375-meter resolution, spotting smaller and cooler fires that older sensors missed. PyroSync uses seasonal relationships measured during the years when both satellites overlap to translate older records onto the modern scale, letting you compare fire activity fairly across all ${years} years.`,
    paragraph3Title: 'How reliable are the numbers?',
    paragraph3: (area: string, errPct: number, blendLabel: string) =>
      `Months from ${blendLabel} onward are direct satellite measurements. Earlier months are statistical estimates. In cross-checks over ${area}, estimated monthly totals typically differed from the satellite benchmark by about ${errPct}%. The scaling was fitted and checked on ${area} data only, so it should be re-checked before it is applied to another region. When examining smaller custom areas, monthly estimates are less certain, so we recommend viewing wider areas or annual totals for local studies.`,
    glossaryTitle: 'Glossary',
    glossaryHotspotTitle: 'Hotspot detection',
    glossaryHotspotDef: 'One satellite pixel flagged as burning. It is not the same as one fire.',
    glossaryEstimatedTitle: 'Estimated month',
    glossaryEstimatedDef: (blendLabel: string) =>
      `Months before ${blendLabel} where counts are translated from older MODIS observations using seasonal models.`,
    glossaryMeasuredTitle: 'Measured month',
    glossaryMeasuredDef: (blendLabel: string) =>
      `Months from ${blendLabel} onward directly observed by the high-resolution VIIRS satellite sensor.`,
    advancedTitle: 'Advanced settings and technical details',
    advancedDescription:
      'Inspect raw sensor counts, exact coordinates, or scientific validation parameters.',
    sensorToggleLabel: 'Sensor data view:',
    rawModis: 'Raw MODIS (1 km)',
    rawViirs: 'Raw VIIRS (375 m)',
    harmonizedUnified: 'Standardized count (recommended)',
  },

  footer: {
    archiveNote: 'Data from the NASA FIRMS archive.',
    coverageNote: (end: string) => `The record ends ${end}.`,
    detectionSemantics: 'Counts are satellite detections, not fires or burned area.',
    accessibilityLink: 'Accessibility statement',
  },
} as const;

export default copy;

