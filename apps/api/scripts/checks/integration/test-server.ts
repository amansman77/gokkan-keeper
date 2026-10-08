import { createHarness } from './harness';
const { mf } = await createHarness(18787);
console.log('Isolated test API ready:', String(await mf.ready));
const stop = () => { void mf.dispose().then(() => process.exit(0)); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
