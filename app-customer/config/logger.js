// Logger module for application
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if not exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Format for log
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

// Logger configuration
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        logFormat
    ),
    transports: [
        // Log to file
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log') 
        }),
        // Log to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                logFormat
            )
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'exceptions.log') 
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                logFormat
            )
        })
    ]
});

module.exports = { logger };
