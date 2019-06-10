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
	// Master calls this when it calls pool.exec()
	parentPort.on("message", async (param) => {
		numSlaves++;

		console.log("workerData is", workerData);

		const result = await scrapeSites(param.data, param.id, outputProgress);

		if (--numSlaves == 0)
			await fs.close(outfileDescriptor, (err) => {
				if (err) throw err;
			});

		// Returns the result to the master.
		parentPort.postMessage(result);
	});
}

// This is here to minimize the number of file descriptors to the output file
async function outputProgress({ site, targetFound }) {
	await fs.appendFile(outfileDescriptor, `${site},${targetFound}\r\n`, 'utf8', (err) => {
		if (err) throw err;
	});
}
