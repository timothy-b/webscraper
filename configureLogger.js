const bunyan = require('bunyan');

function configureLogger(name) {
	const log = bunyan.createLogger({name: name,
		streams: [
		{
			level: 'info',
			stream: process.stdout
		},
		{
			level: 'info',
			path: 'log.log'
		}
	]});

	log._emit = (rec, noemit) => {
		delete rec.hostname;
		delete rec.pid;
		delete rec.v;
		bunyan.prototype._emit.call(log, rec, noemit);
	};

	return log;
}

module.exports = configureLogger;
