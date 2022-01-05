const winston = require('winston');

const productionTransport = new winston.transports.Console({ 
	stderrLevels: ['error'],
	format: winston.format.json(),
	handleExceptions: true,
});

const prettyTransport = new winston.transports.Console({
    stderrLevels: ['error'],
    format: winston.format.prettyPrint(),
	handleExceptions: true,
})

const logger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'dunham-cron-worker' },
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(prettyTransport);
} else {
	logger.add(productionTransport)
}

module.exports = logger;