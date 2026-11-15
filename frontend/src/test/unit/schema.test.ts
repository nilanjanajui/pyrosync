import { describe, it, expect } from 'vitest';
import {
  ManifestSchema,
  CellMonthsSchema,
  HarmonizationSchema,
  GridGeoJsonSchema,
} from '../../datasource/schema';
import fs from 'fs';
import path from 'path';

describe('Data Contract & Zod Schema Validation', () => {
  const datasetsDir = path.resolve(__dirname, '../../../public/datasets');

  it('validates manifest.json with Zod', () => {
    const raw = fs.readFileSync(path.join(datasetsDir, 'manifest.json'), 'utf-8');
    const manifest = JSON.parse(raw);
    const parsed = ManifestSchema.parse(manifest);
    // Real dataset: synthetic is false
    expect(typeof parsed.synthetic).toBe('boolean');
    expect(parsed.coverage.start).toBe('2000-11');
    expect(parsed.coverage.end).toBe('2021-12');
    expect(parsed.viirsStart).toBe('2012-01');
    expect(parsed.viirsFirstCompleteMonth).toBe('2012-02');
    expect(parsed.grid.cells).toBeGreaterThan(0);
  });

  it('validates cell_months.json with Zod', () => {
    const raw = fs.readFileSync(path.join(datasetsDir, 'cell_months.json'), 'utf-8');
    const cm = JSON.parse(raw);
    const parsed = CellMonthsSchema.parse(cm);
    expect(parsed.months.length).toBe(254);
    expect(parsed.cells.length).toBeGreaterThan(0);
    expect(parsed.modis.n.length).toBe(parsed.modis.cell.length);
    expect(parsed.viirs.n.length).toBe(parsed.viirs.cell.length);
  });

  it('validates grid.geojson with Zod', () => {
    const raw = fs.readFileSync(path.join(datasetsDir, 'grid.geojson'), 'utf-8');
    const grid = JSON.parse(raw);
    const parsed = GridGeoJsonSchema.parse(grid);
    expect(parsed.type).toBe('FeatureCollection');
    expect(parsed.features.length).toBeGreaterThan(0);
    expect(parsed.features[0].properties.id).toBeDefined();
  });

  it('validates harmonization.json with Zod', () => {
    const raw = fs.readFileSync(path.join(datasetsDir, 'harmonization.json'), 'utf-8');
    const harm = JSON.parse(raw);
    const parsed = HarmonizationSchema.parse(harm);
    expect(parsed.status).toBe('provisional');
    expect(parsed.blendStart).toBe('2012-02');
    expect(parsed.firstAquaMonth).toBe('2002-07');
    // Real data: exact values from phase6_metadata.json (not rounded synthetic values)
    expect(parsed.seasonalRatios.DJF).toBeCloseTo(3.3149, 3);
    expect(parsed.seasonalRatios.JJA).toBeCloseTo(4.2747, 3);
    expect(parsed.terraOnlyRatios.DJF).toBeCloseTo(7.7141, 3);
    // CI regenerates synthetic datasets (wape=0.129), while committed datasets carry real exports (~0.12853)
    expect(parsed.validation.wape).toBeCloseTo(0.1285, 2);
    expect(parsed.validation.forwardTestBias).toBeCloseTo(-0.0959, 3);
    expect(parsed.perMonthSources.months.length).toBe(254);
  });

  it('fails validation on corrupted manifest.json and flags missing field', () => {
    const raw = fs.readFileSync(path.join(datasetsDir, 'malformed/manifest.json'), 'utf-8');
    const corrupted = JSON.parse(raw);
    expect(() => ManifestSchema.parse(corrupted)).toThrow();

    try {
      ManifestSchema.parse(corrupted);
    } catch (err: unknown) {
      const zodErr = err as { issues: Array<{ path: Array<string | number> }> };
      expect(zodErr.issues[0].path).toContain('studyArea');
    }
  });
});
