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
    tagline: 'California wildfire activity from satellites, 2000–2021',
    howItWorksButton: 'How it works',
    downloadButton: 'Download CSV',
  },

  syntheticBanner: {
    badge: 'DEMO DATA',
    message: 'Showing simulated data for testing. Not for operational fire management decisions.',
  },

  regions: {
    all: 'All California',
    north: 'North',
    central: 'Central',
    south: 'South',
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
    jumpToRecord: 'Jump to peak: Aug 2020',
  },

  summary: {
    title: 'Area and month summary',
    detectionsLabel: 'Hotspot detections',
    percentileHigherThan: (pct: number, month: string) =>
      `higher than ${pct}% of ${month}s since 2000`,
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
    legendEstimated: 'Estimated (pre-2012)',
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
    filenamePrefix: 'pyrosync_california_fire_detections',
  },

  drawer: {
    title: 'How PyroSync Works and Data Accuracy',
    closeButton: 'Close',
    paragraph1Title: 'How satellites see fires',
    paragraph1:
      'Satellites scan California from space day and night, picking up infrared heat from active burning. When a satellite pixel shows an unusual heat signature, it is recorded as a "fire hotspot detection." A detection is a satellite sighting of heat during an orbit—it is not the same as one single wildfire or the total acreage burned.',
    paragraph2Title: 'Connecting two generations of satellites',
    paragraph2:
      'From 2000 to 2011, NASA relied on the MODIS instrument, which observes the earth in 1-kilometer grid boxes. In 2012, the sharper VIIRS instrument began operating with 375-meter resolution, spotting smaller and cooler fires that older sensors missed. PyroSync uses seasonal relationships measured during 10 years of dual-satellite overlap to translate older records onto the modern scale, letting you compare fire activity fairly across all 22 years.',
    paragraph3Title: 'How reliable are the numbers?',
    paragraph3:
      'Months from February 2012 onward are direct satellite measurements. Earlier months are statistical estimates. In regional cross-checks, estimated monthly totals matched satellite benchmarks within about 13%. When examining smaller custom areas, monthly estimates are less certain, so we recommend viewing wider areas or annual totals for local studies.',
    glossaryTitle: 'Glossary',
    glossaryHotspotTitle: 'Hotspot detection',
    glossaryHotspotDef: 'One satellite pixel flagged as burning. It is not the same as one fire.',
    glossaryEstimatedTitle: 'Estimated month',
    glossaryEstimatedDef:
      'Months before February 2012 where counts are translated from older MODIS observations using seasonal models.',
    glossaryMeasuredTitle: 'Measured month',
    glossaryMeasuredDef:
      'Months from February 2012 onward directly observed by the high-resolution VIIRS satellite sensor.',
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
    coverageNote: 'The record ends December 2021.',
    detectionSemantics: 'Counts are satellite detections, not fires or burned area.',
    accessibilityLink: 'Accessibility statement',
  },
} as const;

export default copy;
