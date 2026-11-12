import { conflict } from '../lib/http.js';

/* Canonical consultation lifecycle. Keep policy checks (who may act and when)
   at the call site; this module owns only the legal status graph. */
export const CONSULTATION_TRANSITIONS = Object.freeze({
    reserved: Object.freeze(['confirmed', 'cancelled', 'rescheduled']),
    confirmed: Object.freeze(['completed', 'no_show', 'cancelled', 'rescheduled']),
    completed: Object.freeze(['no_show']),
    no_show: Object.freeze(['completed']),
    cancelled: Object.freeze([]),
    rescheduled: Object.freeze([]),
});

export function assertConsultationTransition(from, to) {
    if (!CONSULTATION_TRANSITIONS[from]?.includes(to)) {
        throw conflict(`A ${from} consultation cannot be marked ${to}.`, 'INVALID_TRANSITION');
    }
}
