import { useEffect } from "react";
import { CalendarGrid } from "./components/CalendarGrid";
import { ComparePanel } from "./components/ComparePanel";
import { Navigator } from "./components/Navigator";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { useAppStore, useSelectedUniversity } from "./store/appStore";

function StatusBanner() {
  const generateResult = useAppStore((s) => s.generateResult);
  const university = useSelectedUniversity();
  if (!generateResult || !university) return null;

  if (generateResult.blockedCourses.length > 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-300">
        No hay combinaciones posibles: {generateResult.blockedCourses.map((c) => c.name).join(", ")} no tiene(n)
        cupos disponibles en ningún grupo.
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

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const currentGroups = generateResult?.combinations[currentIndex]?.groups ?? [];

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-[var(--text-faint)]">Cargando…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <StatusBanner />
          <Navigator />
          <CalendarGrid groups={currentGroups} />
        </div>
        {compareOpen && <ComparePanel />}
      </div>
      <SettingsDrawer />
    </div>
  );
}
