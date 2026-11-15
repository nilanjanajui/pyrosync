/**
 * Sensor-era dates come from the dataset manifest, not from code, so a different region or
 * record period works without edits. Defaults match the California dataset and the unit tests.
 */
export interface Era {
  /** First month measured completely by VIIRS (YYYY-MM). Earlier months are estimated. */
  blendStart: string;
  /** Months where VIIRS only partly covers the month. */
  partialMonths: string[];
  /** First month with Aqua data; earlier months are Terra-only. null = not applicable. */
  firstAquaMonth: string | null;
}

let era: Era = { blendStart: '2012-02', partialMonths: ['2012-01'], firstAquaMonth: '2002-07' };

export const setEra = (e: Era): void => {
  era = e;
};
export const getEra = (): Era => era;
