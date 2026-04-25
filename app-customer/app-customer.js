const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const { logger } = require('./config/logger');
const fs = require('fs');
const session = require('express-session');
const { getSetting } = require('./config/settingsManager');

// Initialize at least Express application (only for health check)
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: getSetting('session_secret', 'customer-portal-secret-default-change-this'), // Can be changed in settings.json: "session_secret"
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Constants
const VERSION = '1.0.0';

// Global variable to store all settings from settings.json
global.appSettings = {
  // Server
  port: getSetting('server_port', 4555),
  host: getSetting('server_host', 'localhost'),
  
  // Admin
  adminUsername: getSetting('admin_username', 'admin'),
  adminPassword: getSetting('admin_password', 'admin'),
  
  // GenieACS
  genieacsUrl: getSetting('genieacs_url', 'http://localhost:7557'),
  genieacsUsername: getSetting('genieacs_username', ''),
  genieacsPassword: getSetting('genieacs_password', ''),
  
  // Company Info
  companyHeader: getSetting('company_header', 'ISP Monitor'),
  footerInfo: getSetting('footer_info', ''),
};

// Route for health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: VERSION
    });
});

// Redirect root to customer portal
app.get('/', (req, res) => {
  res.redirect('/customer/login');
});

// Short alias: /login → /customer/login
app.get('/login', (req, res) => {
  res.redirect('/customer/login');
});

// Import GenieACS commands module
const genieacsCommands = require('./config/genieacs-commands');

// Add view engine and static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
// Mount customer portal
const customerPortal = require('./routes/customerPortal');
app.use('/customer', customerPortal);

// Function to start server with handling of already used port
function startServer(portToUse) {
    logger.info(`Trying to start server on port ${portToUse}...`);
    
    // Try alternative port if main port is not available
    try {
        const server = app.listen(portToUse, () => {
            logger.info(`Server successfully started on port ${portToUse}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            // Update global.appSettings.port with successfully used port
            global.appSettings.port = portToUse.toString();
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.warn(`WARNING: Port ${portToUse} is already used, trying alternative port...`);
                // Try alternative port (port + 1000)
                const alternativePort = portToUse + 1000;
                logger.info(`Trying alternative port: ${alternativePort}`);
                
                // Create new server with alternative port
                const alternativeServer = app.listen(alternativePort, () => {
                    logger.info(`Server successfully started on alternative port ${alternativePort}`);
                    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
                    // Update global.appSettings.port with successfully used port
                    global.appSettings.port = alternativePort.toString();
                }).on('error', (altErr) => {
                    logger.error(`ERROR: Failed to start server on alternative port ${alternativePort}:`, altErr.message);
                    process.exit(1);
                });
            } else {
                logger.error('Error starting server:', err);
                process.exit(1);
            }
        });
    } catch (error) {
        logger.error(`Error occurred while starting server:`, error);
        process.exit(1);
    }
}

// Start server with port from settings.json
const port = global.appSettings.port;
logger.info(`Attempting to start server on configured port: ${port}`);

// Start server with port from configuration
startServer(port);

// Add command to add customer number to GenieACS tag
const { addCustomerTag } = require('./config/customerTag');

// Export app for testing
module.exports = app;
