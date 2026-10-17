import { createServer } from 'node:http';
import { handleRequest } from './app.js';

const port = Number(process.env.PORT || 4000);

createServer(handleRequest).listen(port, () => {
    console.log(`Gradmire API listening on http://localhost:${port}`);
});
