# Arquitectura

## Principio general

`packages/core` no importa nada de React ni del DOM. Es TypeScript puro: tipos de dominio, el motor de combinaciones, y los adaptadores de universidad. `apps/web` es la única capa que sabe que existe una pantalla. Esta separación es la corrección estructural más importante respecto a la v1, donde las clases de dominio (`course`, `group`, `schedule`) generaban su propio HTML y tocaban el DOM directamente (`document.getElementsByClassName(...)`), acoplando lógica de negocio y presentación de forma que ninguna de las dos se podía probar ni cambiar de forma aislada.

## `packages/core`

```
src/
  model/            Course, Group, ScheduleSlot, University, CombinationConfig - datos planos
  combination/       conflicts.ts (detección de choques), score.ts (puntaje), generate.ts (backtracking)
  adapters/          un adaptador por universidad + tipos compartidos + shared.ts (helpers de parseo)
  ics/               exportación a iCalendar
  test-utils.ts      factories para pruebas (slot/group/course)
```

### El motor de combinaciones

`generateCombinations(courses, options)` hace backtracking curso por curso: para cada curso elegible, prueba cada grupo disponible; si el grupo elegido choca de horario con algo ya elegido en esa rama (`findConflict`, en `conflicts.ts`), la rama se descarta ahí mismo - nunca se termina de construir una combinación con cruce, así que no hace falta filtrarla después. Esto reemplaza el enfoque de la v1 (generar el producto cartesiano completo de todos los grupos de todos los cursos, y recién ahí puntuar y filtrar), que escalaba mal y además tenía el bug de dejar pasar combinaciones con exactamente un cruce.

Una vez que una rama completa un curso por combinación sin choques, `scoreCombination` (en `score.ts`) le asigna un puntaje basado en las preferencias del usuario (`CombinationConfig`): día libre, horario de almuerzo, huecos, rango horario, bloques de tiempo libre manuales. El puntaje es solo para *ordenar* combinaciones ya válidas - no participa en decidir si una combinación es válida (eso ya lo garantizó el backtracking).

### Adaptadores

Cada universidad implementa la interfaz `UniversityAdapter` (`adapters/types.ts`): una función `parse(rawText) → { courses, warnings }`. Nada de estado global mutable compartido entre parseos (la v1 tenía variables de módulo como `actual_group`, `stop`, `isLab` que un parseo interrumpido o dos parseos concurrentes podían dejar inconsistentes). Los `warnings` son de primera clase: cuando el adaptador no puede leer una línea, lo reporta en vez de tragarse el error en un `catch {}` vacío como hacía la v1.

Ver `docs/ADAPTER_GUIDE.md` para cómo agregar una universidad nueva.

## `apps/web`

- **Estado**: un solo store de Zustand (`src/store/appStore.ts`). Reemplaza las variables globales sueltas de la v1 (`selected_university`, `cachedUniversities`, etc.) por un único lugar con forma explícita, y cada mutación persiste a IndexedDB inmediatamente (no solo en `beforeunload`, que era el único punto de guardado de la v1 y podía perder cambios).
- **Persistencia**: `src/lib/db.ts`, una tabla de Dexie keyed por id de universidad. Todo lo que se guarda es JSON-serializable de forma nativa porque el dominio en `@unapp/core` son tipos planos, no instancias de clase.
- **Componentes**: presentacionales, leen del store con los selectores de Zustand (`useAppStore((s) => s.x)`) y llaman a las acciones del store para mutar. Ningún componente conoce la forma interna de `CombinationConfig` más allá de lo que necesita renderizar.
- **Calendario**: grilla propia (`CalendarGrid.tsx` + `lib/calendarLayout.ts`) con CSS grid, en vez de una librería de calendario de terceros - el layout es simple (una semana, sin fechas reales, sin drag-and-drop) y no justificaba la dependencia pesada que usaba la v1 (FullCalendar) para este caso de uso.

## Decisiones explícitas que se dejaron fuera (por ahora)

- **Web Worker para la generación**: el backtracking con poda ya es sustancialmente más rápido que el enfoque de la v1 (ver la prueba de rendimiento en `generate.test.ts`), así que no fue necesario todavía para que la UI se sintiera responsiva. Si un plan de estudios muy grande (muchos cursos con muchos grupos cada uno) demuestra lo contrario, mover `generateCombinations` a un Worker es un cambio localizado.
- **Selección de subconjunto de cursos por límite de créditos**: `CombinationConfig.minCredits`/`maxCredits` hoy solo *advierten* si la selección fija de cursos se pasa del límite (`GenerateResult.creditsWithinLimits`), no eligen automáticamente qué cursos excluir para encajar en el límite - eso es una búsqueda combinatoria distinta (sobre subconjuntos de cursos, no solo de grupos) que se dejó fuera del alcance de esta primera versión.
