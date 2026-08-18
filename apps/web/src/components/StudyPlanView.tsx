import { useMemo } from "react";
import { groupCoursesByLevel } from "../lib/studyPlan";
import { useSelectedUniversity } from "../store/appStore";

export function StudyPlanView() {
  const university = useSelectedUniversity();
  const levels = useMemo(() => groupCoursesByLevel(university?.courses ?? []), [university]);

  if (!university) return null;

  if (university.courses.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--text-faint)]">
        Agrega cursos para ver el plan de estudios.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <p className="text-[11px] text-[var(--text-faint)]">
        Agrupación aproximada según los prerrequisitos de tus propios cursos - no es el pénsum oficial completo.
      </p>
      <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
        {levels.map((levelCourses, i) => (
          <div
            key={i}
            className="flex w-64 shrink-0 flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3"
          >
            <div className="font-display text-[13px] font-semibold text-[var(--text)]">Nivel {i + 1}</div>
            {levelCourses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col gap-1 rounded-lg border p-2.5"
                style={{ borderColor: course.color, background: "var(--panel-alt)" }}
              >
                <div className="text-xs font-semibold text-[var(--text)]">{course.name}</div>
                <div className="font-mono text-[10px] text-[var(--text-faint)]">
                  {course.id} · {course.credits}cr · {course.groups.length} grupo(s)
                </div>
                {course.requirements.length > 0 && (
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Requiere: {course.requirements.map((r) => r.courseName).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
