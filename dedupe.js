const fs = require('fs');

// TODO: run if this file was not imported
async function main() {
	await dedupe(writeOut);
};
//main();

async function dedupe(handleDedupedData) {
    await fs.readFile('input.txt', { encoding: 'utf8', flag: 'r' }, async (err, data) => {
		if (err) throw err;
		await readOutput(data.split('\r\n'), handleDedupedData);
	});
}

async function readOutput(mainData, handleDedupedData) {
    await fs.readFile('output.csv', { encoding: 'utf8', flag: 'r' }, async (err, data) => {
		if (err) throw err;
        const outputData = data.split('\r\n').map(d => d.slice(0, d.indexOf(',')));
        await dedupeData(mainData, outputData, handleDedupedData);
	});
}

async function dedupeData(mainData, outputData, handleDedupedData) {
    const deduped = [];
    const outputSet = new Set(outputData);
    for (const d of mainData) {
        if (!outputSet.has(d))
            deduped.push(d);
    }
    await handleDedupedData(deduped);
}

async function writeOut(deduped) {
    await fs.open('deduped.csv', 'a', async (err, fd) => {
		if (err) throw err;
        
        for (const d of deduped) {
            await fs.appendFile(fd, `${d}\r\n`, 'utf8', (err) => {
                if (err) throw err;
            });
        }

        console.log("deduped");

        await fs.close(fd, (err) => {
            if (err) throw err;
        });
	});
}

module.exports = dedupe;
