import { useEffect, useRef, useState } from "react";
import { CalendarGrid } from "./components/CalendarGrid";
import { ComparePanel } from "./components/ComparePanel";
import { Navigator } from "./components/Navigator";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { Sidebar } from "./components/Sidebar";
import { StudyPlanView } from "./components/StudyPlanView";
import { TopBar } from "./components/TopBar";
import { exportElementAsImage } from "./lib/exportImage";
import { useAppStore, useSelectedUniversity } from "./store/appStore";

type View = "schedule" | "plan";

function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const tab = (id: View, label: string) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      className="rounded-md px-3 py-1.5 text-xs font-semibold"
      style={{
        color: view === id ? "var(--accent-ink)" : "var(--text-muted)",
        background: view === id ? "var(--accent)" : "transparent",
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1">
      {tab("schedule", "Horario")}
      {tab("plan", "Plan de estudios")}
    </div>
  );
}

function StatusBanner() {
  const generateResult = useAppStore((s) => s.generateResult);
  const university = useSelectedUniversity();
  if (!generateResult || !university) return null;

  if (generateResult.blockedCourses.length > 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-300">
        No hay combinaciones posibles: {generateResult.blockedCourses.map((c) => c.name).join(", ")} no tiene(n)
        grupos agregados todavía.
      </div>
    );
  }
  if (generateResult.combinations.length === 0) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
        No se encontró ninguna combinación sin cruces de horario con los cursos seleccionados.
      </div>
    );
  }
  if (!generateResult.creditsWithinLimits) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-300">
        {generateResult.totalCredits} créditos seleccionados - fuera del límite configurado en Ajustes.
      </div>
    );
  }
  return null;
}

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const compareOpen = useAppStore((s) => s.compareOpen);
  const generateResult = useAppStore((s) => s.generateResult);
  const currentIndex = useAppStore((s) => s.currentIndex);
  const university = useSelectedUniversity();
  const [view, setView] = useState<View>("schedule");
  const [exportingImage, setExportingImage] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const currentGroups = generateResult?.combinations[currentIndex]?.groups ?? [];

  async function handleExportImage() {
    if (!scheduleRef.current || exportingImage) return;
    setExportingImage(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportElementAsImage(scheduleRef.current, `horario-${university?.id ?? "unapp"}-${stamp}.png`);
    } finally {
      setExportingImage(false);
    }
  }

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-[var(--text-faint)]">Cargando…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <ViewTabs view={view} onChange={setView} />
          {view === "schedule" ? (
            <>
              <StatusBanner />
              <Navigator onExportImage={handleExportImage} exportingImage={exportingImage} />
              <CalendarGrid ref={scheduleRef} groups={currentGroups} />
            </>
          ) : (
            <StudyPlanView />
          )}
        </div>
        {view === "schedule" && compareOpen && <ComparePanel />}
      </div>
      <SettingsDrawer />
    </div>
  );
}
