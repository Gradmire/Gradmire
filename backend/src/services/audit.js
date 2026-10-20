/* Append-only audit trail for account and staff actions. Never store passwords,
   tokens or message bodies in `details`. */
export async function audit(client, { actorUserId = null, action, entityType = null, entityId = null, details = {} }) {
    await client.query(
        'INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
        [actorUserId, action, entityType, entityId, JSON.stringify(details)],
    );
}

export async function recordConsultationEvent(client, { consultationId, actorUserId = null, actorType, event, details = {} }) {
    await client.query(
        'INSERT INTO consultation_events (consultation_id, actor_user_id, actor_type, event, details) VALUES ($1, $2, $3, $4, $5)',
        [consultationId, actorUserId, actorType, event, JSON.stringify(details)],
    );
}
