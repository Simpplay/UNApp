# UNApp v2

Generador de horarios universitarios: pega el texto exportado por el portal de tu universidad (o agrega cursos a mano), y UNApp arma automáticamente todas las combinaciones de horario sin cruces, ordenadas por qué tan bien se ajustan a tus preferencias (días libres, horario de almuerzo, huecos entre clases, rango horario disponible).

Esta es una reescritura completa de [UNApp (v1)](../unapp-old), conservando la idea del producto pero resolviendo los problemas estructurales de la versión anterior: estado global mutable, cero pruebas, un intérprete de texto casero con bugs de puntuación silenciosos, y una interfaz basada en ventanas modales de una librería de alertas. El repositorio anterior queda archivado como referencia histórica.

## Qué cambió respecto a la v1

- **4 bugs de puntuación corregidos** en el motor de combinaciones (días libres que nunca se excluían, un bloque de tiempo libre que rompía el puntaje a `NaN`, un límite de huecos por día que ignoraba su propio interruptor de "desactivado", y combinaciones con cruce de horario real que pasaban como "válidas"). Cada uno tiene una prueba de regresión en `packages/core/src/combination/score.test.ts` y `generate.test.ts`.
- **Generación por backtracking con poda**, en vez de generar el producto cartesiano completo de grupos y filtrar después - una combinación con cruce nunca se construye, en vez de generarse y descartarse.
- **Adaptadores tipados por universidad** (`packages/core/src/adapters/`) en vez de un lenguaje de reglas basado en regex con estado mutable global.
- **Sin estado global**: el store (Zustand) y el motor de dominio (`@unapp/core`, funciones puras sin DOM) están separados de la interfaz.
- **Persistencia en IndexedDB** (Dexie) en vez de `localStorage`, sin límite de 5MB y sin serialización manual de instancias de clases.
- **Interfaz nueva**: layout de una sola pantalla con barra lateral, navegador de combinaciones con insignias de calidad, comparador de combinaciones fijadas, panel de ajustes deslizable - sin ventanas de alerta para cada interacción.
- **Exportación a `.ics`** (Google Calendar / Outlook / Apple Calendar), además de la exportación a PNG que ya existía.

## Estructura

```
apps/
  web/            interfaz (Vite + React + TypeScript + Tailwind)
packages/
  core/           dominio, motor de combinaciones, adaptadores - TypeScript puro, sin DOM
docs/
  ARCHITECTURE.md
  ADAPTER_GUIDE.md
```

## Desarrollo

Requiere Node ≥20 y [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm test         # corre las pruebas de @unapp/core
pnpm --filter @unapp/core exec vitest run
pnpm dev           # levanta la interfaz en http://localhost:5173
pnpm build         # build de producción
pnpm lint
```

## Estado actual / limitaciones conocidas

- **Adaptadores de universidad sin validar contra una exportación real.** Los tres adaptadores (`unal.ts`, `udea.ts`, `funlam.ts`) se reconstruyeron a partir de las reglas del intérprete de texto de la v1 (que sí documentan el formato de origen), no a partir de una exportación real capturada - eso habría significado guardar datos de matrícula de otra persona. Antes de confiar en ellos en producción: pega una exportación fresca y real de cada universidad, corre el adaptador correspondiente, y ajusta los `__fixtures__/*.fixture.txt` con el formato real si difiere. Cada adaptador documenta esta suposición en un comentario al inicio del archivo.
- **UdeA no reporta créditos** en el formato de exportación soportado (tampoco lo hacía la v1) - hay que completarlos a mano por ahora.
- **FUNLAM no tiene combinaciones que generar**: su exportación es "mis cursos ya matriculados", no un catálogo de grupos a elegir - ver el comentario en `adapters/funlam.ts`.
- **La vista de "Plan de estudios"** (orden topológico por prerrequisitos, existía como `planner.js` en la v1) todavía no se portó a la v2 - quedó fuera del alcance de esta primera pasada para priorizar que el flujo principal (cursos → combinaciones → calendario) funcionara de punta a punta con las correcciones de bugs.
- **Sin pruebas end-to-end todavía** (Playwright está en el plan, no implementado). Las pruebas actuales cubren `packages/core` con pruebas unitarias; `apps/web` se verificó manualmente en navegador durante el desarrollo pero no tiene suite automatizada propia.
- **Importar datos de la v1**: aún no existe un importador del JSON que exportaba la v1 (`university.getAsJSON()`). El esquema de `@unapp/core` es compatible en espíritu (mismos campos conceptuales), así que un importador es un paso relativamente mecánico cuando se necesite.

## Licencia

Por definir.
