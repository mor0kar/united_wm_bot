/**
 * Leichter In-Memory-Status für die Status-Seite.
 *
 * Hält die letzten Aktionen des Bots (Posts, Start) als Ringpuffer — kein
 * persistenter State, passt zur Architektur (alles live, nichts gespeichert).
 * Nach einem Neustart ist der Log leer, das ist okay.
 */

export interface StatusEvent {
  at: string; // ISO-Zeitstempel
  kind: "start" | "digest" | "reminder" | "result" | "sportschau";
  summary: string;
}

const MAX_EVENTS = 15;
const events: StatusEvent[] = [];

/** Hält die jüngste Aktion fest (vorne einfügen, alte abschneiden). */
export function recordEvent(kind: StatusEvent["kind"], summary: string): void {
  events.unshift({ at: new Date().toISOString(), kind, summary });
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
}

/** Liefert die jüngsten Aktionen (neueste zuerst). */
export function getEvents(): StatusEvent[] {
  return [...events];
}
