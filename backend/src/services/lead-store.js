const leads = [];

export function createLead(input) {
    const lead = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
    };

    leads.push(lead);
    return lead;
}

export function listLeads() {
    return [...leads];
}