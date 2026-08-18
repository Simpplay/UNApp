import { useAppStore } from "../store/appStore";
import { ChevronLeftIcon, ChevronRightIcon, PinIcon } from "./icons";

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" }) {
  return (
    <span
      className="rounded font-mono text-[11px] font-semibold"
      style={{
        padding: "5px 9px",
        background: tone === "accent" ? "rgba(110,231,208,0.12)" : "var(--bg)",
        color: tone === "accent" ? "var(--accent)" : "var(--text-muted)",
        border: tone === "accent" ? "none" : "1px solid var(--border)",
      }}
    >
      {children}
    </span>
  );
}

export function Navigator() {
  const generateResult = useAppStore((s) => s.generateResult);
  const currentIndex = useAppStore((s) => s.currentIndex);
  const goTo = useAppStore((s) => s.goToCombination);
  const pinCurrent = useAppStore((s) => s.pinCurrent);
  const toggleCompare = useAppStore((s) => s.toggleCompare);

  const combos = generateResult?.combinations ?? [];
  const total = combos.length;
  const combo = combos[currentIndex];

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3.5 py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => goTo(-1)}
          disabled={total === 0}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] disabled:opacity-30"
        >
          <ChevronLeftIcon width={13} height={13} />
        </button>
        <div className="font-mono text-[13px]">
          {total === 0 ? "0 / 0" : `${currentIndex + 1} / ${total}`}
        </div>
        <button
          type="button"
          onClick={() => goTo(1)}
          disabled={total === 0}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] disabled:opacity-30"
        >
          <ChevronRightIcon width={13} height={13} />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {combo && (
          <>
            <Badge tone="accent">0 CRUCES</Badge>
            {combo.details.excessHoleDays.length > 0 && <Badge>{combo.details.excessHoleDays.length} DÍAS CON HUECOS</Badge>}
            {combo.details.outOfRangeHits > 0 && <Badge>{combo.details.outOfRangeHits} FUERA DE RANGO</Badge>}
            {combo.details.freeDayHits > 0 && <Badge>{combo.details.freeDayHits} EN DÍA LIBRE</Badge>}
            <Badge>SCORE {combo.score}</Badge>
            <button
              type="button"
              onClick={() => pinCurrent(`Combinación ${currentIndex + 1}`)}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)]"
              aria-label="Fijar combinación"
              title="Fijar para comparar"
            >
              <PinIcon width={13} height={13} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={toggleCompare}
          className="ml-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Comparar
        </button>
      </div>
    </div>
  );
}
