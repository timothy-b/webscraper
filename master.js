const fs = require('fs');
const { StaticPool } = require('node-worker-threads-pool');

const filePath = 'C:/personal-code/webscraper/slave.js';

const numWorkers = 4;

const pool = new StaticPool({
	size: numWorkers,
	task: filePath,
	workerData: 'unused'
});

async function main() {
	await fs.readFile('input.txt', { encoding: 'utf8', flag: 'r' }, async (err, data) => {
		if (err) throw err;
		await startSlaves(data);
	});
};

async function startSlaves(data) {
	const datas = data.split('\r\n');
	const dataChunks = enumerateInterleavedChunks(datas, numWorkers);

	const slaves = [];
	for (const i of [...Array(numWorkers).keys()])
		slaves.push(pool.exec({ data: dataChunks[i], id: `worker ${i}` }));

	const results = await Promise.all(slaves);
	pool.destroy();

	const finalResults = [];
	for (const result of results)
		for (const item of result)
			finalResults.push(item);

	console.log(finalResults);
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
