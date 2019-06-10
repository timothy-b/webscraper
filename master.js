const configureLogger = require('./configureLogger.js');
const dedupe = require('./dedupe.js');
const path = require('path');
const { StaticPool } = require('node-worker-threads-pool');

const filePath = path.join(process.cwd(), 'slave.js');
const numWorkers = 8;
let log;

async function main() {
	log = configureLogger('master');
	await dedupe(runSlaves);
};

async function runSlaves(data) {
	const pool = new StaticPool({
		size: numWorkers,
		task: filePath,
		workerData: 'unused'
	});

	const dataChunks = enumerateInterleavedChunks(data, numWorkers);

	const slaves = [];
	for (const i of [...Array(numWorkers).keys()])
		slaves.push(pool.exec({ data: dataChunks[i], id: `worker ${i}` }));

	const firstResult = await Promise.race(slaves);
	
	const tinyAmountOfWorkItems = 100;
	// recursive case: there is still much work to be done; redistribute pool
	if (firstResult.length > tinyAmountOfWorkItems && numWorkers > 1) {
		log.info('rebalancing pool');
		await pool.destroy();
		await dedupe(runSlaves);
	} else {
		const results = await Promise.all(slaves);
		await pool.destroy();
		const finalResults = [];
		for (const result of results)
			for (const item of result)
				finalResults.push(item);
		console.log(finalResults);
	}
}

function enumerateInterleavedChunks(data, numChunks) {
	const chunked = [];

	for (const _ of [...Array(numChunks).keys()])
		chunked.push([]);

	let i = 0;
	for (const d of [...Array(data.length).keys()]) {
		chunked[i++].push(data[d]);
		if (i === numChunks)
			i = 0;
	}

	return chunked;
}

main();
