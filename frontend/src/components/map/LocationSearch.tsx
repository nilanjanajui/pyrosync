import React, { useState, useEffect, useRef, useId } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';
import copy from '../../copy';

interface LocationSearchProps {
  onSelectLocation: (lat: number, lon: number, name: string) => void;
  studyBBox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}

interface PlaceResult {
  id: string;
  name: string;
  subtitle?: string;
  lat: number;
  lon: number;
}

// Built-in California places & prominent fire-monitored regions for instant 0ms offline search
const DEFAULT_CALIFORNIA_PLACES: PlaceResult[] = [
  { id: 'p1', name: 'Yosemite National Park', subtitle: 'Mariposa / Tuolumne County', lat: 37.8651, lon: -119.5383 },
  { id: 'p2', name: 'Sierra National Forest', subtitle: 'Fresno / Madera County', lat: 37.2762, lon: -119.2995 },
  { id: 'p3', name: 'Lake Tahoe', subtitle: 'Placer / El Dorado County', lat: 39.0968, lon: -120.0324 },
  { id: 'p4', name: 'Redding & Shasta-Trinity', subtitle: 'Shasta County', lat: 40.5865, lon: -122.3917 },
  { id: 'p5', name: 'Paradise / Camp Fire Area', subtitle: 'Butte County', lat: 39.7596, lon: -121.6219 },
  { id: 'p6', name: 'Sequoia & Kings Canyon', subtitle: 'Tulare / Fresno County', lat: 36.4864, lon: -118.5658 },
  { id: 'p7', name: 'Malibu & Santa Monica Mtns', subtitle: 'Los Angeles County', lat: 34.0259, lon: -118.7798 },
  { id: 'p8', name: 'Big Sur & Los Padres', subtitle: 'Monterey County', lat: 36.2704, lon: -121.8081 },
  { id: 'p9', name: 'Napa & Sonoma Valleys', subtitle: 'Wine Country', lat: 38.2975, lon: -122.2869 },
  { id: 'p10', name: 'Los Angeles', subtitle: 'Southern California', lat: 34.0522, lon: -118.2437 },
  { id: 'p11', name: 'San Francisco Bay Area', subtitle: 'Northern California', lat: 37.7749, lon: -122.4194 },
  { id: 'p12', name: 'San Diego', subtitle: 'Southern California', lat: 32.7157, lon: -117.1611 },
  { id: 'p13', name: 'Sacramento', subtitle: 'Central Valley', lat: 38.5816, lon: -121.4944 },
  { id: 'p14', name: 'Fresno', subtitle: 'San Joaquin Valley', lat: 36.7468, lon: -119.7726 },
  { id: 'p15', name: 'Santa Barbara', subtitle: 'Central Coast', lat: 34.4208, lon: -119.6982 },
  { id: 'p16', name: 'Palm Springs & Coachella', subtitle: 'Riverside County', lat: 33.8303, lon: -116.5453 },
];

export const LocationSearch: React.FC<LocationSearchProps> = ({ onSelectLocation, studyBBox }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Search logic
  useEffect(() => {
    // Parse coordinate input: e.g. "37.86, -119.53"
    const tryParseCoords = (text: string): { lat: number; lon: number } | null => {
      const cleaned = text.trim().replace(/[°NWES]/gi, '');
      const parts = cleaned.split(/[\s,]+/).filter(Boolean);
      if (parts.length === 2) {
        const p0 = parseFloat(parts[0]);
        const p1 = parseFloat(parts[1]);
        if (!isNaN(p0) && !isNaN(p1)) {
          // Decide lat/lon ordering based on study bounds
          if (p0 >= studyBBox[1] - 5 && p0 <= studyBBox[3] + 5 && p1 <= studyBBox[2] + 5 && p1 >= studyBBox[0] - 5) {
            return { lat: p0, lon: p1 };
          }
          if (p1 >= studyBBox[1] - 5 && p1 <= studyBBox[3] + 5 && p0 <= studyBBox[2] + 5 && p0 >= studyBBox[0] - 5) {
            return { lat: p1, lon: p0 };
          }
        }
      }
      return null;
    };

    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Check direct coordinate input
    const parsedCoords = tryParseCoords(trimmed);
    if (parsedCoords) {
      setResults([
        {
          id: 'coords',
          name: `${parsedCoords.lat.toFixed(4)}°, ${parsedCoords.lon.toFixed(4)}°`,
          subtitle: 'Direct Geographic Coordinates',
          lat: parsedCoords.lat,
          lon: parsedCoords.lon,
        },
      ]);
      setIsOpen(true);
      return;
    }

    // Instant local preset search
    const localMatches = DEFAULT_CALIFORNIA_PLACES.filter(
      (p) =>
        p.name.toLowerCase().includes(trimmed) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(trimmed))
    );

    if (localMatches.length > 0) {
      setResults(localMatches);
      setIsOpen(true);
    }

    // Debounced online geocoding via Nominatim
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [minLon, minLat, maxLon, maxLat] = studyBBox;
        const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          trimmed
        )}&countrycodes=us&viewbox=${viewbox}&bounded=0&limit=5`;

        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        if (res.ok) {
          const data = (await res.json()) as Array<{
            place_id: number;
            display_name: string;
            lat: string;
            lon: string;
          }>;

          const remoteMatches: PlaceResult[] = data.map((item) => {
            const parts = item.display_name.split(',');
            const primaryName = parts[0]?.trim() || item.display_name;
            const subtitle = parts.slice(1, 3).join(',').trim();
            return {
              id: `nom-${item.place_id}`,
              name: primaryName,
              subtitle: subtitle || 'Location in study area',
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
            };
          });

          // Merge without duplicates
          const seen = new Set(localMatches.map((m) => `${m.lat.toFixed(2)},${m.lon.toFixed(2)}`));
          const uniqueRemote = remoteMatches.filter(
            (r) => !seen.has(`${r.lat.toFixed(2)},${r.lon.toFixed(2)}`)
          );

          setResults([...localMatches, ...uniqueRemote]);
        }
      } catch {
        // Fallback to local matches if offline
      } finally {
        setIsLoading(false);
        setIsOpen(true);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [query, studyBBox]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (place: PlaceResult) => {
    setQuery(place.name);
    setIsOpen(false);
    onSelectLocation(place.lat, place.lon, place.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = selectedIndex >= 0 ? results[selectedIndex] : results[0];
      if (target) handleSelect(target);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-72 md:w-80 font-sans z-30">
      <div className="relative flex items-center">
        <label htmlFor="location-search-input" className="sr-only">
          {copy.map.searchAriaLabel}
        </label>
        <Search className="w-4 h-4 text-amber-400 absolute left-3 pointer-events-none" />
        <input
          id="location-search-input"
          type="text"
          role="combobox"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={copy.map.searchPlaceholder}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          className="w-full pl-9 pr-8 py-2 bg-app-surface1/90 backdrop-blur-md text-white text-xs sm:text-sm rounded-lg border border-app-border hover:border-gray-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-app-textMuted transition-all shadow-inner"
        />

        {isLoading ? (
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin absolute right-2.5" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            aria-label={copy.map.clearSearch}
            className="absolute right-2 p-1 text-gray-400 hover:text-white rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto bg-app-surface1 border border-app-border rounded-lg shadow-2xl divide-y divide-app-border/40 text-xs font-sans z-50 focus:outline-none"
        >
          {results.map((place, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li
                key={place.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(place)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-3 py-2 cursor-pointer flex items-start gap-2.5 transition-colors ${
                  isSelected ? 'bg-amber-500/20 text-white' : 'text-gray-200 hover:bg-app-surface2'
                }`}
              >
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-white">{place.name}</div>
                  {place.subtitle && (
                    <div className="text-[11px] text-app-textMuted truncate">{place.subtitle}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch;
