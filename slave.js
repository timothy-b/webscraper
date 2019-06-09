// Access the workerData by requiring it.
const { parentPort, workerData } = require('worker_threads');
const scrapeSites = require('./index.js');

// Main thread will pass the data you need
// through this event listener.
parentPort.on("message", async (param) => {
	// Access the workerData.
	console.log("workerData is", workerData);

	const result = await scrapeSites(param.data, param.id);

	// return the result to main thread.
	parentPort.postMessage(result);
});