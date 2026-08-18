# Cómo agregar una universidad nueva

Un adaptador traduce el texto que un estudiante pega desde el portal de su universidad a `Course[]` tipado. Vive en `packages/core/src/adapters/<id>.ts`.

## 1. Consigue una muestra real del formato

Pide (o pega tú mismo) el texto exportado por el portal de la universidad para un par de cursos con varios grupos. **No** guardes datos reales de matrícula de otra persona en el repo - una vez que entiendas el formato, construye un fixture con datos inventados que tenga la misma estructura (ver `adapters/__fixtures__/unal.fixture.txt` como ejemplo).

## 2. Implementa `UniversityAdapter`

```ts
import type { ParseResult, UniversityAdapter } from "./types.js";

export function parseMiUniversidad(rawText: string): ParseResult {
  const warnings = [];
  const courses = [];
  // recorre rawText línea por línea, construye courses/warnings
  return { courses, warnings };
}

export const miUniversidadAdapter: UniversityAdapter = {
  id: "miuniversidad",
  name: "Nombre completo de la universidad",
  parse: (text) => parseMiUniversidad(text),
};
```

Reglas generales, aprendidas de los tres adaptadores existentes:

- **No uses estado a nivel de módulo.** Todo el estado de parseo (curso actual, grupo actual, etc.) debe vivir en variables locales dentro de la función `parse`, no en variables `let` a nivel de archivo - así el adaptador es reentrante y fácil de probar en paralelo.
- **Reporta lo que no puedas leer.** Si una línea no matchea ningún patrón esperado donde deberías tener uno, agrega un `warnings.push({ message, line })` en vez de ignorarlo silenciosamente. La interfaz se lo muestra al usuario.
- **No inventes datos que la fuente no tiene.** Si la universidad no reporta cupo, usa `-1` (el valor centinela de "desconocido" en `Group.quota`), no `0` (que significa "sin cupo" y desactivaría el grupo) ni un número inventado. Ver el comentario sobre créditos en `adapters/udea.ts` como ejemplo de cómo documentar un vacío real de la fuente en vez de rellenarlo.
- **Usa los helpers de `adapters/shared.ts`** para fechas (`ddmmyyyyToIso`), horas en formato "7:00 a.m." (`parseMeridiemTime`, `parseSpanishTimeRange`) y horas 24h (`parse24hTimeRange`) - no repitas el parseo de fechas/horas en cada adaptador.

## 3. Escribe las pruebas

Crea `adapters/<id>.test.ts` que lea el fixture y verifique: nombre/id/créditos del curso, cada campo de grupo (profesor, cupo, horario con su día y hora correctos), y que las advertencias esperadas (o la ausencia de ellas) coincidan. Los tres adaptadores existentes son la plantilla a seguir.

## 4. Regístralo

Agrégalo a `builtInAdapters` en `adapters/index.ts`.

## 5. Antes de confiar en él con datos reales

Pega una exportación real y fresca del portal (la tuya, no la de otra persona) en la app corriendo en desarrollo (`pnpm dev`), importa el texto, y confirma en el calendario que cursos/grupos/horarios quedaron donde esperabas. Si algo no coincide, ajusta el adaptador y actualiza el fixture con un caso que reproduzca la diferencia - no arregles el síntoma sin dejar una prueba que lo cubra.
