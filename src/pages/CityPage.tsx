import { CitySections } from '../components/CitySections';
import { CITY_VIEW_KEY, readCityView } from '../lib/city-access';
import { CityMatchday } from '../components/CityMatchday';
import { CityShortcuts } from '../components/CityShortcuts';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CityMap, WorkQueue } from '../components/City';
export default function CityPage() {
  const [jobs, setJobs] = useState(false),
    [view, setView] = useState(readCityView);
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = toolbar.current!;
    const observer = new ResizeObserver(() =>
      node.parentElement?.style.setProperty('--city-toolbar-height', `${node.offsetHeight + 8}px`),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={`city-page city-view-${view}`}>
      <h1 className="sr-only">Ciudad deportiva</h1>
      <div className="city-topbar" ref={toolbar}>
        <div className="city-view-switch" role="group" aria-label="Vista de la ciudad">
          {(['map', 'sections'] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={view === mode}
              onClick={() => {
                setView(mode);
                try {
                  localStorage.setItem(CITY_VIEW_KEY, mode);
                } catch {
                  /* Session-only preference. */
                }
              }}
            >
              {mode === 'map' ? 'Mapa' : 'Secciones'}
            </button>
          ))}
        </div>
        <CityMatchday />
      </div>
      <div className="city-content">{view === 'map' ? <CityMap /> : <CitySections />}</div>
      <CityShortcuts jobsOpen={jobs} toggleJobs={() => setJobs(!jobs)} />
      {jobs && (
        <div id="city-jobs" className="city-jobs-panel" role="region" aria-label="Obras de tu club">
          <div className="row spread">
            <h2>Tu club está creciendo</h2>
            <button aria-label="Cerrar construcciones" onClick={() => setJobs(false)}>
              <X />
            </button>
          </div>
          <WorkQueue />
        </div>
      )}
    </div>
  );
}
