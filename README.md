# FretQuest

Juego de entrenamiento de teoría musical sobre un mástil de guitarra (React + TypeScript + Vite, sin backend).

```
npm install
npm run dev      # desarrollo
npm test         # tests de teoría, evaluador, generadores (bot perfecto), SRS y juego
npm run build    # tsc + vite build
```

Parámetros útiles: `?unlock=all` desbloquea todas las etapas; `?debug` expone `__game` / `__solve()` en `window`.

## Arquitectura (`src/`)

| Carpeta | Responsabilidad |
|---|---|
| `theory/` | Notas, intervalos, acordes, escalas. Aritmética módulo 12, determinista. Nuevas calidades de acorde = añadir a `CHORD_FORMULAS`. |
| `fretboard/` | Afinación, `Position {string, fret}`, MIDI de cada posición, regiones. Nada hardcodeado por posición. |
| `engine/` | `evaluator.ts`: valida clics (nota, intervalo, acorde, elección) y `autoSolve` (revela soluciones y sirve de bot en tests). |
| `challenges/` | Generadores por etapa. Un desafío = lista de pasos (`StepSpec`) + tiempo opcional. Cada «tipo» es una entrada de `KindDef`. |
| `progression/` | Etapas (registro `STAGES`) y niveles que suben/bajan por rendimiento. Añadir «Escalas» = nueva entrada + generadores. |
| `srs/` | Repetición espaciada invisible por concepto (`note:F#`, `int:7`, `chord:D:maj`): maestría, racha, fallos, último tick. Sesga el sorteo de conceptos. |
| `game/` | `Game`: estado de sesión (vidas, racha, puntos, temporizadores) sin React; `discovery.ts` genera las explicaciones cortas. |
| `audio/` | Interfaz `AudioEngine` (sin implementación en el MVP). |
| `ui/` | Mástil SVG, HUD, pantallas. |

## Reglas clave

- **Intervalos**: ascendentes, distancia exacta en semitonos (cualquier par de posiciones equivalente vale; la octava exige +12).
- **Acordes**: una nota por cuerda, máximo 4 trastes de separación (mano real), cualquier inversión/duplicación vale; se completa al cubrir todas las notas del acorde.
- **Vidas**: 5; cada error, tiempo agotado o rendición resta 1; +1 cada 6 aciertos seguidos. 3 errores en un desafío lo fallan y muestran la respuesta.
- **Nivel** (1–5, por etapa): sube con 8 desafíos recientes de ≥80 % de acierto, baja con ≥50 % de fallos. Las etapas 2 y 3 se desbloquean con nivel 2 de la anterior.
