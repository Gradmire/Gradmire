import { createServer } from 'node:http';
import { healthRoute } from './routes/health.js';
import { leadsRoute } from './routes/leads.js';

const port = Number(process.env.PORT || 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';

const server = createServer(async(request, response) => {
    response.setHeader('Access-Control-Allow-Origin', frontendOrigin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    if (healthRoute(request, response) || await leadsRoute(request, response)) {
        return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, () => {
    console.log(`Gradmire API listening on http://localhost:${port}`);
});