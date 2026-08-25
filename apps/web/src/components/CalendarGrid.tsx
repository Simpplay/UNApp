import { formatHHmm, WEEKDAY_LABEL_ES, type Group } from "@unapp/core";
import { forwardRef, useMemo } from "react";
import { useSelectedUniversity } from "../store/appStore";
import { computeHourRange, computeVisibleDays, minutesToRow, ROW_HEIGHT_PX, rowCount } from "../lib/calendarLayout";

export const CalendarGrid = forwardRef<HTMLDivElement, { groups: Group[] }>(function CalendarGrid({ groups }, ref) {
  const university = useSelectedUniversity();
  const config = university?.config;

  const range = useMemo(() => (config ? computeHourRange(groups, config) : { startHour: 7, endHour: 20 }), [groups, config]);
  const days = useMemo(() => (config ? computeVisibleDays(groups, config) : []), [groups, config]);
  const rows = rowCount(range);

  const hourLabels = Array.from({ length: range.endHour - range.startHour }, (_, i) => range.startHour + i);

  const nameByCourse = new Map<string, { name: string; color: string }>(
    university?.courses.map((c) => [c.id, { name: c.name, color: c.color }]) ?? [],
  );

  if (!config) return null;

  return (
    <div
      ref={ref}
      className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
    >
      <div
        className="grid shrink-0 border-b border-[var(--border)]"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
      >
        <div />
        {days.map((d) => (
          <div
            key={d}
            className="border-l border-[var(--border-soft)] py-2 text-center font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]"
          >
            {WEEKDAY_LABEL_ES[d].slice(0, 3)}
          </div>
        ))}
      </div>

      <div className="relative flex-1 overflow-y-auto" data-export-scroll>
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, gridTemplateRows: `repeat(${rows}, ${ROW_HEIGHT_PX}px)` }}
        >
          {hourLabels.map((h) => (
            <div
              key={`line-${h}`}
              style={{ gridColumn: "1 / -1", gridRow: minutesToRow(h * 60, range), borderTop: "1px solid var(--border-soft)" }}
            />
          ))}
          {days.map((_, i) => (
            <div
              key={`col-${i}`}
              style={{ gridColumn: i + 2, gridRow: `1 / -1`, borderLeft: "1px solid var(--border-soft)" }}
            />
          ))}
          {hourLabels.map((h) => (
            <div
              key={`label-${h}`}
              style={{
                gridColumn: 1,
                gridRow: `${minutesToRow(h * 60, range)} / span 2`,
                transform: "translateY(-5px)",
                textAlign: "right",
                paddingRight: 8,
              }}
              className="font-mono text-[10px] text-[var(--text-faint)]"
            >
              {formatHHmm(h * 60)}
            </div>
          ))}

          {config.lunchTime && (
            <div
              style={{
                gridColumn: `2 / span ${days.length}`,
                gridRow: `${minutesToRow(config.lunchTime.start, range)} / ${minutesToRow(config.lunchTime.end, range)}`,
                background:
                  "repeating-linear-gradient(45deg, var(--border-soft), var(--border-soft) 4px, transparent 4px, transparent 8px)",
              }}
            />
          )}

          {config.freeTime.map((block) => {
            const col = days.indexOf(block.day);
            if (col === -1) return null;
            return (
              <div
                key={block.id}
                style={{
                  gridColumn: col + 2,
                  gridRow: `${minutesToRow(block.time.start, range)} / ${minutesToRow(block.time.end, range)}`,
                  margin: 2,
                  borderRadius: 6,
                  border: `1.5px dashed ${block.color}`,
                  color: "var(--text-faint)",
                  fontSize: 10,
                  padding: "4px 6px",
                }}
              >
                {block.name}
              </div>
            );
          })}

          {groups.flatMap((group) =>
            group.slots.map((slot, i) => {
              const col = days.indexOf(slot.day);
              if (col === -1) return null;
              const meta = nameByCourse.get(group.parentCourseId);
              return (
                <div
                  key={`${group.parentCourseId}-${group.id}-${i}`}
                  style={{
                    gridColumn: col + 2,
                    gridRow: `${minutesToRow(slot.time.start, range)} / ${minutesToRow(slot.time.end, range)}`,
                    margin: 2,
                    borderRadius: 6,
                    padding: "5px 7px",
                    background: meta?.color ?? "#5B8CFF",
                    color: "#0B0F14",
                    fontSize: 10,
                    fontWeight: 600,
                    overflow: "hidden",
                  }}
                >
                  {meta?.name ?? group.parentCourseId}
                  <br />
                  <span className="font-mono font-normal opacity-70">
                    {formatHHmm(slot.time.start)}–{formatHHmm(slot.time.end)}
                  </span>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
});
