import {fileURLToPath} from 'node:url';
import {createStaticServer} from './scripts/static-server.mjs';

const port = Number(process.env.PORT || 4178);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
const server = await createStaticServer(fileURLToPath(new URL('./dist/', import.meta.url)));
server.listen(port, '127.0.0.1', () => console.log(`Roadster cockpit: http://127.0.0.1:${port}`));
