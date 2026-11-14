import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useAppStore } from '../../store/appStore';
import { aoiSeries } from '../../domain/aggregate';
import { buildClimatology, median } from '../../domain/stats';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const AnalyticsCharts: React.FC = () => {
  const { dataset, selectedCellIndexes, activeMonth, setActiveMonth } = useAppStore();

  const selectedYear = useMemo(() => {
    if (activeMonth) {
      return parseInt(activeMonth.split('-')[0], 10);
    }
    return 2020;
  }, [activeMonth]);

  const selectedCalMonth = useMemo(() => {
    if (activeMonth) {
      return parseInt(activeMonth.split('-')[1], 10) - 1; // 0-11
    }
    return 7; // Aug
  }, [activeMonth]);

  // Chart 1: 2000–2021 Cross-Sensor Harmonization Annual Series
  const harmonizationData = useMemo(() => {
    if (!dataset) return [];

    const harm = aoiSeries(dataset, selectedCellIndexes, 'harmonized');
    const mod = aoiSeries(dataset, selectedCellIndexes, 'modis');
    const viir = aoiSeries(dataset, selectedCellIndexes, 'viirs');

    const yearMap = new Map<number, { harm: number; modis: number; viirs: number; viirsCount: number }>();

    for (let i = 0; i < dataset.months.length; i++) {
      const yr = parseInt(dataset.months[i].split('-')[0], 10);
      if (!yearMap.has(yr)) {
        yearMap.set(yr, { harm: 0, modis: 0, viirs: 0, viirsCount: 0 });
      }
      const entry = yearMap.get(yr)!;
      entry.harm += harm.values[i] || 0;
      entry.modis += mod.values[i] || 0;
      if (!isNaN(viir.values[i])) {
        entry.viirs += viir.values[i];
        entry.viirsCount++;
      }
    }

    const data = [];
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
    for (const yr of sortedYears) {
      const e = yearMap.get(yr)!;
      data.push({
        year: yr.toString(),
        harmonized: Math.round(e.harm),
        modis: Math.round(e.modis),
        viirs: e.viirsCount > 0 ? Math.round(e.viirs) : null,
      });
    }
    return data;
  }, [dataset, selectedCellIndexes]);

  // Chart 2: Seasonal Monthly Profile for Selected Year vs Multi-Year Median
  const seasonalData = useMemo(() => {
    if (!dataset) return [];

    const harm = aoiSeries(dataset, selectedCellIndexes, 'harmonized');
    const climatology = buildClimatology(dataset.months, harm.values);

    // Calculate multi-year median for each calendar month (1-12)
    const medians: number[] = [];
    for (let c = 1; c <= 12; c++) {
      const vals = climatology.get(c) || [];
      medians.push(Math.round(median(vals) || 0));
    }

    // Extract monthly values for the selected year
    const yearHarmVals = new Array(12).fill(0);
    for (let i = 0; i < dataset.months.length; i++) {
      const [yrStr, monStr] = dataset.months[i].split('-');
      if (parseInt(yrStr, 10) === selectedYear) {
        const mIdx = parseInt(monStr, 10) - 1;
        yearHarmVals[mIdx] = Math.round(harm.values[i] || 0);
      }
    }

    return MONTH_NAMES.map((name, idx) => {
      const harmVal = yearHarmVals[idx];
      const medVal = medians[idx];
      const isSelected = idx === selectedCalMonth;
      const isSurge = harmVal > medVal * 1.15;

      return {
        month: name,
        monthIndex: idx,
        harmonized: harmVal,
        median: medVal,
        isSelected,
        fillColor: isSelected
          ? '#38BDF8'
          : isSurge
          ? 'rgba(239, 68, 68, 0.85)'
          : 'rgba(245, 158, 11, 0.75)',
      };
    });
  }, [dataset, selectedCellIndexes, selectedYear, selectedCalMonth]);

  const handleBarClick = (data: { monthIndex?: number }) => {
    if (data && typeof data.monthIndex === 'number') {
      const monStr = String(data.monthIndex + 1).padStart(2, '0');
      setActiveMonth(`${selectedYear}-${monStr}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Chart 1: Cross-Sensor Harmonization Line Chart */}
      <div className="bg-app-surface1 rounded-2xl p-4 border border-app-border flex flex-col shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white font-mono">
              2000–2021 Cross-Sensor Harmonization
            </h3>
            <p className="text-[11px] text-app-textMuted font-mono">
              Raw MODIS (2000+) &amp; VIIRS (2012+) vs. Unified Harmonized Index
            </p>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
            22-Yr Series
          </span>
        </div>
        <div className="relative h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={harmonizationData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(31, 41, 55, 0.5)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  borderColor: '#374151',
                  borderRadius: '0.75rem',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#F3F4F6',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }}
                formatter={(val) => <span className="text-gray-300 font-mono">{val}</span>}
              />
              <Line
                type="monotone"
                dataKey="harmonized"
                name="Harmonized Unified"
                stroke="#38BDF8"
                strokeWidth={2.5}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="modis"
                name="Raw MODIS (1km)"
                stroke="#F59E0B"
                strokeWidth={1.8}
                strokeDasharray="4 3"
                dot={{ r: 1.5 }}
              />
              <Line
                type="monotone"
                dataKey="viirs"
                name="Raw VIIRS (375m)"
                stroke="#D946EF"
                strokeWidth={1.8}
                dot={{ r: 1.5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Seasonal Monthly Profile vs Historical Median */}
      <div className="bg-app-surface1 rounded-2xl p-4 border border-app-border flex flex-col shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white font-mono">
              {selectedYear} Seasonal Profile vs. Historical Median
            </h3>
            <p className="text-[11px] text-app-textMuted font-mono">
              Monthly harmonized detection records vs 2000–2021 median (click to inspect)
            </p>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Anomaly Check
          </span>
        </div>
        <div className="relative h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={seasonalData}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload.length > 0) {
                  handleBarClick(e.activePayload[0].payload);
                }
              }}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(31, 41, 55, 0.5)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  borderColor: '#374151',
                  borderRadius: '0.75rem',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#F3F4F6',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }}
                formatter={(val) => <span className="text-gray-300 font-mono">{val}</span>}
              />
              <Bar
                dataKey="harmonized"
                name={`${selectedYear} Harmonized`}
                fill="#F59E0B"
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="median"
                name="22-Yr Median"
                stroke="#9CA3AF"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

