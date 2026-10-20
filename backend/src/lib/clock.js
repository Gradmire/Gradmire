/* The current time, replaceable in tests so slot and policy rules are deterministic. */
let override = null;

export const now = () => (override ? new Date(override.getTime()) : new Date());
export function setNow(date) {
    override = date ? new Date(date) : null;
}
