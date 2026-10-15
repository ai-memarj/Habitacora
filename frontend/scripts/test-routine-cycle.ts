/**
 * Pruebas de `src/lib/routine-cycle.ts` — la aritmética de ciclos,
 * cupos y rachas de las Rutinas.
 *
 * El proyecto no tiene (todavía) un runner de tests configurado, así que
 * esto se ejecuta a mano:
 *
 *     cd frontend && npx tsx scripts/test-routine-cycle.ts
 *
 * Merece la pena mantenerlo pese a no haber infraestructura de tests
 * porque aquí vive lo más fácil de equivocar de toda la feature: módulos
 * de números negativos (fechas anteriores al ancla del ciclo), ventanas
 * de ciclo, y aritmética de fechas cruzando el cambio de hora — este
 * último ya rompió la navegación de fechas del dashboard una vez (ver
 * CLAUDE.md).
 */
import {
  routineMode, cycleDayIndex, cycleWindowIndex, cycleWindow, cycleAlignsWithWeeks,
  quotaTally, cycleBalance, buildStampDays, streakInfo, daysBetweenISO,
} from "@/lib/routine-cycle";
import type { Routine, RoutineActivity, RoutineItem } from "@/types";

const act = (id: number, name: string, short: string, quota: number | null): RoutineActivity =>
  ({ id, routine_id: 1, name, short_label: short, color: null, position: id, quota });

const activities = [
  act(1, "Boxeo", "BOX", 2), act(2, "Carrera", "CAR", 1), act(3, "Intervalos", "INT", 1),
  act(4, "Circuito", "CIR", 1), act(5, "Fuerza", "FUE", 1), act(6, "Movilidad", "MOV", 1),
  act(7, "Recuperación", "REC", 1), act(8, "Descanso", "DES", 1),
];
const slots = [
  { id: 1, routine_id: 1, activity_id: 1, day_index: 0, position: 0 },
  { id: 2, routine_id: 1, activity_id: 6, day_index: 0, position: 1 },
  { id: 3, routine_id: 1, activity_id: 2, day_index: 1, position: 0 },
  { id: 4, routine_id: 1, activity_id: 5, day_index: 2, position: 0 },
  { id: 5, routine_id: 1, activity_id: 1, day_index: 3, position: 0 },
  { id: 6, routine_id: 1, activity_id: 7, day_index: 3, position: 1 },
  { id: 7, routine_id: 1, activity_id: 3, day_index: 4, position: 0 },
  { id: 8, routine_id: 1, activity_id: 4, day_index: 5, position: 0 },
  { id: 9, routine_id: 1, activity_id: 8, day_index: 6, position: 0 },
];
const entrenos: Routine = {
  id: 1, name: "Entrenos", color: "#E11D48", position: 0,
  cycle_length: 7, cycle_start: "2026-10-05", goal_days: null,
  activities, cycle_slots: slots,
};

let fallos = 0;
function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "  ok  " : " FALLO"} ${msg}`);
  if (!cond) fallos++;
}

console.log("--- modo deducido ---");
ok(routineMode(entrenos) === "cupo", "entrenos -> cupo");
ok(routineMode({ ...entrenos, activities: activities.map(a => ({...a, quota: null})) }) === "pauta", "sin cupos -> pauta");
ok(routineMode({ ...entrenos, goal_days: 30 }) === "reto", "con meta -> reto (gana a los cupos)");

console.log("--- día del ciclo (ancla lunes 5 oct) ---");
ok(cycleDayIndex(entrenos, "2026-10-05") === 0, "lun 5 oct -> día 0");
ok(cycleDayIndex(entrenos, "2026-10-11") === 6, "dom 11 oct -> día 6");
ok(cycleDayIndex(entrenos, "2026-10-12") === 0, "lun 12 oct -> día 0 (vuelve a empezar)");
ok(cycleDayIndex(entrenos, "2026-10-01") === 3, "jue 1 oct (ANTES del ancla) -> día 3, sin módulo negativo");
ok(cycleDayIndex({ ...entrenos, cycle_start: null }, "2026-10-05") === null, "sin ancla -> null");

console.log("--- cambio de hora (DST: 25 oct 2026 en Madrid) ---");
ok(daysBetweenISO("2026-10-24", "2026-10-26") === 2, "cruzar el cambio de hora sigue dando 2 días");
ok(cycleDayIndex(entrenos, "2026-10-26") === 0, "lun 26 oct (tras el DST) -> día 0");

console.log("--- ventanas de ciclo ---");
ok(cycleWindowIndex(entrenos, "2026-10-05") === 0, "semana del ancla -> 0");
ok(cycleWindowIndex(entrenos, "2026-10-12") === 1, "siguiente -> 1");
ok(cycleWindowIndex(entrenos, "2026-10-04") === -1, "anterior -> -1");
ok(cycleWindow(entrenos, 1)?.startISO === "2026-10-12" && cycleWindow(entrenos, 1)?.endISO === "2026-10-18", "ventana 1 = 12..18 oct");
ok(cycleAlignsWithWeeks(entrenos), "ciclo de 7 anclado a lunes -> alinea con las filas");
ok(!cycleAlignsWithWeeks({ ...entrenos, cycle_start: "2026-10-06" }), "anclado a martes -> no alinea");
ok(!cycleAlignsWithWeeks({ ...entrenos, cycle_length: 4 }), "ciclo de 4 -> no alinea");

console.log("--- ¿cuadra el reparto? ---");
const bal = cycleBalance(activities, slots);
ok(bal.balanced && bal.placedTotal === 9 && bal.quotaTotal === 9, "9 de 9 repartidas -> cuadra");
const malo = cycleBalance(activities, slots.filter(s => s.id !== 5).concat([{ id: 99, routine_id: 1, activity_id: 6, day_index: 2, position: 1 }]));
ok(!malo.balanced, "quitar un BOX y meter un MOV de más -> no cuadra");
ok(malo.problems.join(" / ") === "falta 1 BOX / sobra 1 MOV", `mensajes: ${malo.problems.join(" / ")}`);

console.log("--- estampado ---");
const stamped = buildStampDays(entrenos, "2026-10-05", "2026-10-11");
ok(stamped.length === 7, "7 días generados");
ok(JSON.stringify(stamped[0]) === '{"date":"2026-10-05","activity_ids":[1,6]}', "lunes lleva BOX + MOV");
ok(JSON.stringify(stamped[6]) === '{"date":"2026-10-11","activity_ids":[8]}', "domingo lleva DES");
const conSkip = buildStampDays(entrenos, "2026-10-05", "2026-10-11", new Set(["2026-10-06", "2026-10-07"]));
ok(conSkip.length === 5 && !conSkip.some(d => d.date === "2026-10-06"), "skipDates excluye los días ya registrados");
const sinCiclo = buildStampDays({ ...entrenos, cycle_length: null }, "2026-10-05", "2026-10-11");
ok(sinCiclo.length === 0, "sin ciclo no estampa nada");

console.log("--- cupos de una ventana ---");
const item = (id: number, date: string, activity_id: number, done: boolean): RoutineItem =>
  ({ id, routine_id: 1, date, activity_id, label: null, done, position: 0 });
const semana = [
  item(1, "2026-10-05", 1, true), item(2, "2026-10-05", 6, false),
  item(3, "2026-10-06", 2, true), item(4, "2026-10-07", 5, true),
  item(5, "2026-10-08", 1, true), item(6, "2026-10-08", 7, true),
  item(7, "2026-10-09", 3, false), item(8, "2026-10-10", 4, true),
  item(9, "2026-10-11", 8, true),
  item(10, "2026-10-12", 1, true), // semana siguiente: NO debe contar
];
const w0 = cycleWindow(entrenos, 0)!;
const t = quotaTally(entrenos, semana, w0);
ok(t.doneTotal === 7 && t.quotaTotal === 9, `semana 1: ${t.doneTotal}/${t.quotaTotal}`);
ok(t.rows.find(r => r.activity.short_label === "BOX")!.done === 2, "BOX 2/2 (el del día 12 no cuenta)");
ok(t.rows.find(r => r.activity.short_label === "INT")!.done === 0, "INT 0/1 pendiente");
ok(t.rows.find(r => r.activity.short_label === "MOV")!.done === 0, "MOV 0/1 (existe pero sin tachar)");

console.log("--- rachas (reto) ---");
const hoy = new Date();
const iso = (d: number) => {
  const x = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const reto = [item(1, iso(0), 9, true), item(2, iso(-1), 9, true), item(3, iso(-2), 9, true), item(4, iso(-3), 9, false), item(5, iso(-4), 9, true)];
const s = streakInfo(reto);
ok(s.current === 3, `racha actual 3 (hoy + 2 atrás) -> ${s.current}`);
ok(s.doneTotal === 4, `total cumplidos 4 (el roto no cuenta) -> ${s.doneTotal}`);
ok(s.best === 3, `mejor racha 3 -> ${s.best}`);
ok(streakInfo([]).current === 0, "sin items -> racha 0");
const roto = [item(1, iso(0), 9, false)];
ok(streakInfo(roto).current === 0, "hoy roto explícitamente -> racha 0");

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
