const fs = require('fs');

async function main() {
	await fs.readFile('input_orig.txt', { encoding: 'utf8', flag: 'r' }, async (err, data) => {
		if (err) throw err;
		await readOutput(data.split('\r\n'));
	});
};
main();

async function readOutput(mainData) {
    await fs.readFile('output.csv', { encoding: 'utf8', flag: 'r' }, async (err, data) => {
		if (err) throw err;
        const outputData = data.split('\r\n').map(d => d.slice(0, d.indexOf(',')));
        await dedupe(mainData, outputData);
	});
}

async function dedupe(mainData, outputData) {
    const deduped = [];
    const outputSet = new Set(outputData);
    for (const d of mainData) {
        if (!outputSet.has(d))
            deduped.push(d);
    }
    await writeOut(deduped);
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
