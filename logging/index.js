const winston = require('winston');

const productionTransport = new winston.transports.Console({ 
	stderrLevels: ['error'],
	format: winston.format.json(),
	handleExceptions: true,
});

const prettyTransport = new winston.transports.Console({
	level: 'info',
    stderrLevels: ['error'],
    format: winston.format.prettyPrint(),
	handleExceptions: true,
})

const debugFileTransport = new winston.transports.File({
	level: 'debug',
	filename: 'debug.log',
	format: winston.format.json()
})

const logger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'dunham-cron-worker' },
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(prettyTransport);
	logger.add(debugFileTransport)
} else {
	logger.add(productionTransport)
}

module.exports = logger;