// Access the workerData by requiring it.
const { parentPort, workerData } = require('worker_threads');
const scrapeSites = require('./index.js');
const fs = require('fs');

let numSlaves = 0;
let outfileDescriptor;

(async () => {
	await fs.open('output.csv', 'a', (err, fd) => {
		if (err) throw err;
		outfileDescriptor = fd;
	});

	listenToParentPort();
})();

function listenToParentPort() {
	// Main thread will pass the data you need
	// through this event listener.
	parentPort.on("message", async (param) => {
		numSlaves++;
		// Access the workerData.
		console.log("workerData is", workerData);

		const result = await scrapeSites(param.data, param.id, outputProgress);

		console.log(`worker ${param.id} has completed`);

		if (--numSlaves == 0)
			await fs.close(outfileDescriptor, (err) => {
				if (err) throw err;
			});

		// return the result to main thread.
		parentPort.postMessage(result);
	});
}

async function outputProgress({ site, targetFound }) {
	await fs.appendFile(outfileDescriptor, `${site},${targetFound}\r\n`, 'utf8', (err) => {
		if (err) throw err;
	});
}
