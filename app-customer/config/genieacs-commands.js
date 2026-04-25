// genieacs-commands.js - Module for handling GenieACS commands via WhatsApp
const { logger } = require('./logger');
const genieacsApi = require('./genieacs');
// const responses = require('./responses');

// Store the WhatsApp socket instance
let sock = null;

// Set the WhatsApp socket instance
function setSock(sockInstance) {
    sock = sockInstance;
    logger.info('WhatsApp socket set in genieacs-commands module');
}

// Helper functions for device status and parameters
function getDeviceStatus(lastInform) {
    if (!lastInform) return false;
    const now = Date.now();
    const lastInformTime = new Date(lastInform).getTime();
    const timeDiff = now - lastInformTime;
    // Consider device online if last inform was within 5 minutes
    return timeDiff < 5 * 60 * 1000;
}

function formatUptime(uptimeValue) {
    if (!uptimeValue || uptimeValue === 'N/A') return 'N/A';

    // If already formatted (like "5d 04:50:18"), return as is
    if (typeof uptimeValue === 'string' && uptimeValue.includes('d ')) {
        return uptimeValue;
    }

    // If it's seconds, convert to formatted string
    if (!isNaN(uptimeValue)) {
        const seconds = parseInt(uptimeValue);
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        let result = '';
        if (days > 0) result += `${days}d `;
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0) result += `${minutes}m `;
        if (secs > 0) result += `${secs}s`;

        return result.trim() || '0s';
    }

    return uptimeValue;
}

function getParameterWithPaths(device, paths) {
    if (!device || !paths || !Array.isArray(paths)) return 'N/A';

    for (const path of paths) {
        try {
            const value = getParameterValue(device, path);
            if (value && value !== 'N/A') {
                return value;
            }
        } catch (error) {
            // Continue to next path
        }
    }
    return 'N/A';
}

function getParameterValue(device, path) {
    if (!device || !path) return 'N/A';

    try {
        const pathParts = path.split('.');
        let current = device;

        for (const part of pathParts) {
            if (current && typeof current === 'object') {
                current = current[part];
            } else {
                return 'N/A';
            }
        }

        // Handle GenieACS parameter format
        if (current && typeof current === 'object' && current._value !== undefined) {
            return current._value;
        }

        // Handle direct value
        if (current !== null && current !== undefined && current !== '') {
            return current;
        }

        return 'N/A';
    } catch (error) {
        logger.debug(`Error getting parameter ${path}: ${error.message}`);
        return 'N/A';
    }
}

// Parameter paths for different device parameters (updated with confirmed VirtualParameters)
const parameterPaths = {
    rxPower: [
        'VirtualParameters.RXPower',                    // ✅ CONFIRMED: -19.74
        'InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower',
        'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_ALU-COM_RxPower',
        'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.RxPower',
        'Device.Optical.Interface.1.RxPower'
    ],
    pppoeIP: [
        'VirtualParameters.pppoeIP',                    // ✅ CONFIRMED: 192.168.10.159
        'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
        'Device.PPP.Interface.1.IPCPExtensions.RemoteIPAddress'
    ],
    pppUsername: [
        'VirtualParameters.pppoeUsername',              // ✅ CONFIRMED: leha
        'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
        'Device.PPP.Interface.1.Username'
    ],
    uptime: [
        'VirtualParameters.getdeviceuptime',            // ✅ CONFIRMED: 5d 04:50:18
        'InternetGatewayDevice.DeviceInfo.UpTime',
        'Device.DeviceInfo.UpTime'
    ],
    firmware: [
        'InternetGatewayDevice.DeviceInfo.SoftwareVersion',
        'Device.DeviceInfo.SoftwareVersion'
    ],
    userConnected: [
        'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations',  // ✅ SSID 1 (2.4GHz) only
        'VirtualParameters.activedevices',              // ✅ Fallback if needed
        'Device.WiFi.AccessPoint.1.AssociatedDeviceNumberOfEntries'
    ],
    temperature: [
        'VirtualParameters.gettemp',                    // ✅ CONFIRMED: 48
        'InternetGatewayDevice.DeviceInfo.TemperatureStatus.TemperatureValue',
        'Device.DeviceInfo.TemperatureStatus.TemperatureValue'
    ],
    // Additional available VirtualParameters
    serialNumber: [
        'VirtualParameters.getSerialNumber',            // ✅ AVAILABLE: CIOT12E8C8B8
        'InternetGatewayDevice.DeviceInfo.SerialNumber'
    ],
    ponMode: [
        'VirtualParameters.getponmode'                  // ✅ AVAILABLE: EPON
    ],
    pppUptime: [
        'VirtualParameters.getpppuptime'                // ✅ AVAILABLE: 0d 08:46:43
    ],
    ponMac: [
        'VirtualParameters.PonMac',                     // ✅ AVAILABLE (but might be empty)
        'VirtualParameters.ponMac',                     // Alternative lowercase
        'VirtualParameters.MacAddress',                 // Alternative name
        'VirtualParameters.deviceMac',                  // Alternative name
        'VirtualParameters.ontMac',                     // Alternative name
        'InternetGatewayDevice.DeviceInfo.X_ALU-COM_MACAddress',
        'InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.1.MACAddress'
    ],
    wlanPassword: [
        'VirtualParameters.WlanPassword'                // ✅ AVAILABLE
    ]
};

// Using message format from responses.js
function formatResponse(message) {
    return message; // No header/footer used
}

// Get device by phone number
async function getDeviceByNumber(phoneNumber) {
    try {
        return await genieacsApi.findDeviceByPhoneNumber(phoneNumber);
    } catch (error) {
        logger.error(`Error finding device with phone number ${phoneNumber}: ${error.message}`);
        return null;
    }
}

// Handler for WiFi info command
async function handleWifiInfo(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Device not found.')
            });
            return;
        }
        
        // Get SSID information
        const ssid = getSSIDValue(device, '1') || 'N/A';
        const ssid5G = getSSIDValue(device, '5') || 'N/A';
        
        // Send WiFi information
        const wifiInfo = `📱 *WI-FI INFORMATION*\n\n`;
        wifiInfo += `• SSID 2.4G: ${ssid}\n`;
        wifiInfo += `• SSID 5G: ${ssid5G}\n`;
        
        await sock.sendMessage(remoteJid, {
            text: formatResponse(wifiInfo)
        });
    } catch (error) {
        logger.error(`Error handling WiFi info: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse('An error occurred while retrieving WiFi information.')
        });
    }
}

// Handler for change WiFi SSID command
async function handleChangeWifiSSID(remoteJid, senderNumber, newSSID) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        if (!newSSID || newSSID.length < 3 || newSSID.length > 32) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Invalid SSID format. SSID must be between 3-32 characters.')
            });
            return;
        }
        
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Device not found.')
            });
            return;
        }
        
        // Send processing message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse(`Changing device SSID to "${newSSID}"...`)
        });
        
        // Set SSID parameter value
        await genieacsApi.setParameterValues(device._id, {
            'SSID': newSSID
        });
        
        // Send success message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse(`SSID successfully changed to "${newSSID}".`)
        });
        
    } catch (error) {
        logger.error(`Error changing WiFi SSID: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse('An error occurred while changing the SSID.')
        });
    }
}

// Handler for change WiFi password command
async function handleChangeWifiPassword(remoteJid, senderNumber, newPassword) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        if (!newPassword || newPassword.length < 8 || newPassword.length > 63) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Invalid password format. Password must be between 8-63 characters.')
            });
            return;
        }
        
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Device not found.')
            });
            return;
        }
        
        // Send processing message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse('Changing WiFi password...')
        });
        
        // Set password parameter value
        await genieacsApi.setParameterValues(device._id, {
            'KeyPassphrase': newPassword
        });
        
        // Send success message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse('WiFi password successfully changed.')
        });
        
    } catch (error) {
        logger.error(`Error changing WiFi password: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse('An error occurred while changing the WiFi password.')
        });
    }
}

// Handler for device status command
async function handleDeviceStatus(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Device not found.')
            });
            return;
        }
        
        // Get device status information
        const lastInform = device._lastInform;
        const isOnline = getDeviceStatus(lastInform);
        const serialNumber = device.InternetGatewayDevice?.DeviceInfo?.SerialNumber?._value || 'N/A';
        const firmware = getParameterWithPaths(device, parameterPaths.firmware) || 'N/A';
        const uptime = formatUptime(getParameterWithPaths(device, parameterPaths.uptime)) || 'N/A';
        const rxPower = getParameterWithPaths(device, parameterPaths.rxPower) || 'N/A';
        const pppoeIP = getParameterWithPaths(device, parameterPaths.pppoeIP) || 'N/A';
        const pppUsername = getParameterWithPaths(device, parameterPaths.pppUsername) || 'N/A';
        const ssid = getSSIDValue(device, '1') || 'N/A';
        const ssid5G = getSSIDValue(device, '5') || 'N/A';
        const connectedUsers = getParameterWithPaths(device, parameterPaths.userConnected) || '0';
        
        // Format device status
        const statusMessage = `📱 *DEVICE STATUS*\n\n`;
        statusMessage += `• Status Online: ${isOnline ? '🟢 Online' : '🔴 Offline'}\n`;
        statusMessage += `• Serial Number: ${serialNumber}\n`;
        statusMessage += `• Firmware: ${firmware}\n`;
        statusMessage += `• Uptime: ${uptime}\n`;
        statusMessage += `• RX Power: ${rxPower} dBm\n`;
        statusMessage += `• PPPoE IP: ${pppoeIP}\n`;
        statusMessage += `• PPP Username: ${pppUsername}\n`;
        statusMessage += `• SSID 2.4G: ${ssid}\n`;
        statusMessage += `• SSID 5G: ${ssid5G}\n`;
        statusMessage += `• Connected Users: ${connectedUsers}\n`;
        statusMessage += `• Last Inform: ${new Date(lastInform).toLocaleString()}\n`;
        
        await sock.sendMessage(remoteJid, { 
            text: formatResponse(statusMessage)
        });
        
    } catch (error) {
        logger.error(`Error handling device status: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse('An error occurred while retrieving device status.')
        });
    }
}

// Handler for restart device command
async function handleRestartDevice(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Device not found.')
            });
            return;
        }
        
        // Send confirmation message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse('Are you sure you want to restart this device? (type "confirm restart" to proceed)')
        });
        
        // Save restart confirmation status
        global.pendingRestarts = global.pendingRestarts || {};
        global.pendingRestarts[senderNumber] = {
            deviceId: device._id,
            timestamp: Date.now()
        };
        
    } catch (error) {
        logger.error(`Error preparing device restart: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse('An error occurred while preparing device restart.')
        });
    }
}

// Handler for restart confirmation
async function handleRestartConfirmation(remoteJid, senderNumber, confirmed) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        if (!global.pendingRestarts || !global.pendingRestarts[senderNumber]) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('No pending restart request.')
            });
            return;
        }
        
        const { deviceId, timestamp } = global.pendingRestarts[senderNumber];
        
        // Check if confirmation is still valid (within 5 minutes)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Restart request has expired.')
            });
            delete global.pendingRestarts[senderNumber];
            return;
        }
        
        if (confirmed) {
            // Send processing message
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Restarting device...')
            });
            
            // Restart device
            await genieacsApi.reboot(deviceId);
            
            // Send success message
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Device restarted successfully.')
            });
        } else {
            // Send cancellation message
            await sock.sendMessage(remoteJid, { 
                text: formatResponse('Device restart cancelled.')
            });
        }
        
        // Delete restart confirmation status
        delete global.pendingRestarts[senderNumber];
        
    } catch (error) {
        logger.error(`Error handling restart confirmation: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse('An error occurred while confirming restart.')
        });
        
        // Delete restart confirmation status even if error
        if (global.pendingRestarts && global.pendingRestarts[senderNumber]) {
            delete global.pendingRestarts[senderNumber];
        }
    }
}

// Helper function to get SSID value
function getSSIDValue(device, configIndex) {
    try {
        // Try method 1: Using bracket notation for WLANConfiguration
        if (device.InternetGatewayDevice && 
            device.InternetGatewayDevice.LANDevice && 
            device.InternetGatewayDevice.LANDevice['1'] && 
            device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration && 
            device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration[configIndex] && 
            device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration[configIndex].SSID) {
            
            const ssidObj = device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration[configIndex].SSID;
            if (ssidObj._value !== undefined) {
                return ssidObj._value;
            }
        }
        
        // Try method 2: Using getParameterWithPaths
        const ssidPath = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${configIndex}.SSID`;
        const ssidValue = getParameterWithPaths(device, [ssidPath]);
        if (ssidValue && ssidValue !== 'N/A') {
            return ssidValue;
        }
        
        // Try method 3: Search in entire object
        for (const key in device) {
            if (device[key]?.LANDevice?.['1']?.WLANConfiguration?.[configIndex]?.SSID?._value) {
                return device[key].LANDevice['1'].WLANConfiguration[configIndex].SSID._value;
            }
        }
        
        // Try method 4: Check in virtual parameters
        if (device.VirtualParameters?.SSID?._value) {
            return device.VirtualParameters.SSID._value;
        }
        
        if (configIndex === '5' && device.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration?.['2']?.SSID?._value) {
            return device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration['2'].SSID._value;
        }
        
        return 'N/A';
    } catch (error) {
        logger.error(`Error getting SSID for config ${configIndex}: ${error.message}`);
        return 'N/A';
    }
}

// Handler for device factory reset
async function handleFactoryReset(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);

        if (!device) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse('Device not found.')
            });
            return;
        }

        // Send confirmation message
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`⚠️ *FACTORY RESET WARNING*\n\nYou are about to factory reset your device.\nAll settings will be restored to factory defaults.\n\nType "confirm factory reset" to proceed.`)
        });

        // Save factory reset confirmation status
        global.pendingFactoryResets = global.pendingFactoryResets || {};
        global.pendingFactoryResets[senderNumber] = {
            deviceId: device._id,
            timestamp: Date.now()
        };

    } catch (error) {
        logger.error(`Error preparing factory reset: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });
    }
}

// Handler for factory reset confirmation
async function handleFactoryResetConfirmation(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        if (!global.pendingFactoryResets || !global.pendingFactoryResets[senderNumber]) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse(`❌ No pending factory reset request.`)
            });
            return;
        }

        const { deviceId, timestamp } = global.pendingFactoryResets[senderNumber];

        // Check if confirmation is still valid (within 5 minutes)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse(`❌ Factory reset request has expired. Please try again.`)
            });
            delete global.pendingFactoryResets[senderNumber];
            return;
        }

        // Send processing message
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`🔄 Performing factory reset on device...\nPlease wait a few minutes.`)
        });

        // Factory reset device
        await genieacsApi.factoryReset(deviceId);

        // Send success message
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`✅ Factory reset completed successfully.\nThe device will restart and return to factory default settings.`)
        });

        // Delete factory reset confirmation status
        delete global.pendingFactoryResets[senderNumber];

    } catch (error) {
        logger.error(`Error handling factory reset confirmation: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });

        // Delete factory reset confirmation status even if error
        if (global.pendingFactoryResets && global.pendingFactoryResets[senderNumber]) {
            delete global.pendingFactoryResets[senderNumber];
        }
    }
}

// Handler to view devices connected to WiFi
async function handleConnectedDevices(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);

        if (!device) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse('Device not found.')
            });
            return;
        }

        // Get connected devices information
        // Get number of connected users
        const connectedUsers = getParameterWithPaths(device, parameterPaths.userConnected) || '0';

        // Try to get detailed host information
        let hostInfo = '';
        try {
            // Check for host entries in LANDevice
            if (device.InternetGatewayDevice?.LANDevice?.['1']?.Hosts?.Host) {
                const hosts = device.InternetGatewayDevice.LANDevice['1'].Hosts.Host;
                let hostCount = 0;

                for (const hostKey in hosts) {
                    const host = hosts[hostKey];
                    if (host.Active?._value === 'true' || host.Active?._value === true) {
                        hostCount++;
                        if (hostCount <= 10) { // Limit to 10 devices
                            const hostname = host.HostName?._value || 'Unknown';
                            const ip = host.IPAddress?._value || 'N/A';
                            const mac = host.MACAddress?._value || 'N/A';
                            hostInfo += `${hostCount}. ${hostname}\n   IP: ${ip}\n   MAC: ${mac}\n\n`;
                        }
                    }
                }

                if (hostCount > 10) {
                    hostInfo += `... and ${hostCount - 10} more device(s)\n`;
                }
            }
        } catch (error) {
            logger.error(`Error getting detailed host info: ${error.message}`);
        }

        let message = `📱 *CONNECTED DEVICES*\n\n`;
        message += `Active devices: ${connectedUsers}\n\n`;

        if (hostInfo) {
            message += `Device details:\n${hostInfo}`;
        } else {
            message += `Device details not available.`;
        }

        await sock.sendMessage(remoteJid, {
            text: formatResponse(message)
        });

    } catch (error) {
        logger.error(`Error handling connected devices: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });
    }
}

// Handler for admin - view full device details
async function handleAdminDeviceDetail(remoteJid, phoneNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by phone number
        const device = await getDeviceByNumber(phoneNumber);

        if (!device) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse(`❌ Device with number ${phoneNumber} not found.`)
            });
            return;
        }

        // Get device information
        const lastInform = device._lastInform;
        const isOnline = getDeviceStatus(lastInform);
        const serialNumber = device.InternetGatewayDevice?.DeviceInfo?.SerialNumber?._value || 'N/A';
        const firmware = getParameterWithPaths(device, parameterPaths.firmware) || 'N/A';

        const uptime = formatUptime(getParameterWithPaths(device, parameterPaths.uptime)) || 'N/A';

        const rxPower = getParameterWithPaths(device, parameterPaths.rxPower) || 'N/A';
        const pppoeIP = getParameterWithPaths(device, parameterPaths.pppoeIP) || 'N/A';
        const pppUsername = getParameterWithPaths(device, parameterPaths.pppUsername) || 'N/A';
        const ssid = getSSIDValue(device, '1') || 'N/A';
        const ssid5G = getSSIDValue(device, '5') || 'N/A';
        const connectedUsers = getParameterWithPaths(device, parameterPaths.userConnected) || '0';
        const temperature = getParameterWithPaths(device, parameterPaths.temperature) || 'N/A';

        // Additional VirtualParameters
        const ponMode = getParameterWithPaths(device, parameterPaths.ponMode) || 'N/A';
        const pppUptime = getParameterWithPaths(device, parameterPaths.pppUptime) || 'N/A';

        // Get device model and manufacturer
        const manufacturer = device.InternetGatewayDevice?.DeviceInfo?.Manufacturer?._value || 'N/A';
        const model = device.InternetGatewayDevice?.DeviceInfo?.ModelName?._value || 'N/A';
        const hardwareVersion = device.InternetGatewayDevice?.DeviceInfo?.HardwareVersion?._value || 'N/A';

        let message = `🔍 *ADMIN DEVICE DETAILS*\n\n`;
        message += `📱 *Number:* ${phoneNumber}\n`;
        message += `🆔 *Device ID:* ${device._id}\n`;
        message += `📟 *Serial Number:* ${serialNumber}\n`;
        message += `🏭 *Manufacturer:* ${manufacturer}\n`;
        message += `📦 *Model:* ${model}\n`;
        message += `🔧 *Hardware Version:* ${hardwareVersion}\n`;
        message += `💾 *Firmware:* ${firmware}\n\n`;

        message += `🌐 *Connection Status:*\n`;
        message += `• Status: ${isOnline ? '🟢 Online' : '🔴 Offline'}\n`;
        message += `• Last Inform: ${new Date(lastInform).toLocaleString()}\n`;
        message += `• Device Uptime: ${uptime}\n`;
        message += `• PPP Uptime: ${pppUptime}\n`;
        message += `• PPPoE IP: ${pppoeIP}\n`;
        message += `• PPP Username: ${pppUsername}\n\n`;

        message += `📡 *Network Information:*\n`;
        message += `• PON Mode: ${ponMode}\n`;
        message += `• RX Power: ${rxPower} dBm\n`;
        message += `• Temperature: ${temperature}°C\n\n`;

        message += `📶 *WiFi Information:*\n`;
        message += `• SSID 2.4G: ${ssid}\n`;
        message += `• SSID 5G: ${ssid5G}\n`;
        message += `• Connected Devices: ${connectedUsers}\n\n`;

        // Get tags
        if (device._tags && device._tags.length > 0) {
            message += `🏷️ *Tags:* ${device._tags.join(', ')}\n`;
        }

        await sock.sendMessage(remoteJid, {
            text: formatResponse(message)
        });

    } catch (error) {
        logger.error(`Error handling admin device detail: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });
    }
}

// Handler for admin - restart customer device
async function handleAdminRestartDevice(remoteJid, phoneNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by phone number
        const device = await getDeviceByNumber(phoneNumber);

        if (!device) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse(`❌ Device with number ${phoneNumber} not found.`)
            });
            return;
        }

        // Send processing message
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`🔄 Restarting customer device ${phoneNumber}...\nPlease wait a few minutes.`)
        });

        // Restart device
        await genieacsApi.reboot(device._id);

        // Send success message
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`✅ Restart command successfully sent to customer device ${phoneNumber}.\nThe device will restart in a few minutes.`)
        });

    } catch (error) {
        logger.error(`Error handling admin restart device: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });
    }
}

// Handler for admin - factory reset customer device
async function handleAdminFactoryReset(remoteJid, phoneNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by phone number
        const device = await getDeviceByNumber(phoneNumber);

        if (!device) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse(`❌ Device with number ${phoneNumber} not found.`)
            });
            return;
        }

        // Send confirmation message
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`⚠️ *ADMIN FACTORY RESET WARNING*\n\nYou are about to factory reset customer device ${phoneNumber}.\nAll settings will be restored to factory defaults.\n\nType "confirm admin factory reset ${phoneNumber}" to proceed.`)
        });

        // Save factory reset confirmation status
        global.pendingAdminFactoryResets = global.pendingAdminFactoryResets || {};
        global.pendingAdminFactoryResets[phoneNumber] = {
            deviceId: device._id,
            timestamp: Date.now()
        };

    } catch (error) {
        logger.error(`Error preparing admin factory reset: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });
    }
}

// Handler for admin factory reset confirmation
async function handleAdminFactoryResetConfirmation(remoteJid, phoneNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        if (!global.pendingAdminFactoryResets || !global.pendingAdminFactoryResets[phoneNumber]) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse(`❌ No pending factory reset request for number ${phoneNumber}.`)
            });
            return;
        }

        const { deviceId, timestamp } = global.pendingAdminFactoryResets[phoneNumber];

        // Check if confirmation is still valid (within 5 minutes)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse(`❌ Factory reset request for ${phoneNumber} has expired. Please try again.`)
            });
            delete global.pendingAdminFactoryResets[phoneNumber];
            return;
        }

        // Send processing message
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`🔄 Performing factory reset on customer device ${phoneNumber}...\nPlease wait a few minutes.`)
        });

        // Factory reset device
        await genieacsApi.factoryReset(deviceId);

        // Send success message
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`✅ Factory reset completed successfully on customer device ${phoneNumber}.\nThe device will restart and return to factory default settings.`)
        });

        // Delete factory reset confirmation status
        delete global.pendingAdminFactoryResets[phoneNumber];

    } catch (error) {
        logger.error(`Error handling admin factory reset confirmation: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });

        // Delete factory reset confirmation status even if error
        if (global.pendingAdminFactoryResets && global.pendingAdminFactoryResets[phoneNumber]) {
            delete global.pendingAdminFactoryResets[phoneNumber];
        }
    }
}

// Handler to view speed test / bandwidth
async function handleSpeedTest(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);

        if (!device) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse('Device not found.')
            });
            return;
        }

        // Get bandwidth/speed information
        const { getParameterWithPaths } = require('./whatsapp');

        // Try to get bandwidth information from various paths
        const downloadSpeed = getParameterWithPaths(device, [
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.DownstreamMaxBitRate',
            'Device.IP.Interface.1.Stats.BytesReceived'
        ]) || 'N/A';

        const uploadSpeed = getParameterWithPaths(device, [
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.UpstreamMaxBitRate',
            'Device.IP.Interface.1.Stats.BytesSent'
        ]) || 'N/A';

        // Get interface statistics
        const bytesReceived = getParameterWithPaths(device, [
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Stats.BytesReceived',
            'Device.IP.Interface.1.Stats.BytesReceived'
        ]) || 'N/A';

        const bytesSent = getParameterWithPaths(device, [
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Stats.BytesSent',
            'Device.IP.Interface.1.Stats.BytesSent'
        ]) || 'N/A';

        let message = `📊 *BANDWIDTH INFORMATION*\n\n`;
        message += `📥 *Download Speed:* ${downloadSpeed}\n`;
        message += `📤 *Upload Speed:* ${uploadSpeed}\n\n`;
        message += `📈 *Interface Statistics:*\n`;
        message += `• Bytes Received: ${formatBytes(bytesReceived)}\n`;
        message += `• Bytes Sent: ${formatBytes(bytesSent)}\n\n`;
        message += `💡 *Tip:* For an accurate speed test, use a speed test application on your device.`;

        await sock.sendMessage(remoteJid, {
            text: formatResponse(message)
        });

    } catch (error) {
        logger.error(`Error handling speed test: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });
    }
}

// Handler for network diagnostics
async function handleNetworkDiagnostic(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);

        if (!device) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse('Device not found.')
            });
            return;
        }

        // Get diagnostic information
        const { getDeviceStatus, getParameterWithPaths, parameterPaths } = require('./whatsapp');

        const lastInform = device._lastInform;
        const isOnline = getDeviceStatus(lastInform);
        const rxPower = getParameterWithPaths(device, parameterPaths.rxPower) || 'N/A';
        const pppoeIP = getParameterWithPaths(device, parameterPaths.pppoeIP) || 'N/A';
        const temperature = getParameterWithPaths(device, parameterPaths.temperature) || 'N/A';

        // Get connection status
        const wanStatus = getParameterWithPaths(device, [
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ConnectionStatus',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ConnectionStatus'
        ]) || 'N/A';

        // Get DNS servers
        const dnsServers = getParameterWithPaths(device, [
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.DNSServers',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.DNSServers'
        ]) || 'N/A';

        let message = `🔧 *NETWORK DIAGNOSTICS*\n\n`;

        // Connection status
        message += `🌐 *Connection Status:*\n`;
        message += `• Device: ${isOnline ? '🟢 Online' : '🔴 Offline'}\n`;
        message += `• WAN Status: ${wanStatus}\n`;
        message += `• PPPoE IP: ${pppoeIP}\n`;
        message += `• Last Inform: ${new Date(lastInform).toLocaleString()}\n\n`;

        // Signal quality
        message += `📶 *Signal Quality:*\n`;
        message += `• RX Power: ${rxPower} dBm\n`;
        const rxPowerNum = parseFloat(rxPower);
        if (!isNaN(rxPowerNum)) {
            if (rxPowerNum >= -25) {
                message += `• Status: 🟢 Excellent\n`;
            } else if (rxPowerNum >= -27) {
                message += `• Status: 🟡 Good\n`;
            } else if (rxPowerNum >= -30) {
                message += `• Status: 🟠 Fair\n`;
            } else {
                message += `• Status: 🔴 Poor\n`;
            }
        }
        message += `• Temperature: ${temperature}°C\n\n`;

        // Network settings
        message += `⚙️ *Network Settings:*\n`;
        message += `• DNS Servers: ${dnsServers}\n\n`;

        // Recommendations
        message += `💡 *Recommendations:*\n`;
        if (!isOnline) {
            message += `• Device is offline, try restarting the device\n`;
        }
        if (!isNaN(rxPowerNum) && rxPowerNum < -27) {
            message += `• Weak signal, please contact a technician\n`;
        }
        if (!isNaN(parseFloat(temperature)) && parseFloat(temperature) > 70) {
            message += `• High temperature, ensure adequate ventilation\n`;
        }

        await sock.sendMessage(remoteJid, {
            text: formatResponse(message)
        });

    } catch (error) {
        logger.error(`Error handling network diagnostic: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });
    }
}

// Handler to view connection history
async function handleConnectionHistory(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);

        if (!device) {
            await sock.sendMessage(remoteJid, {
                text: formatResponse('Device not found.')
            });
            return;
        }

        // Get connection history information
        const { formatUptime, getParameterWithPaths, parameterPaths } = require('./whatsapp');

        const deviceUptime = formatUptime(getParameterWithPaths(device, parameterPaths.uptime)) || 'N/A';
        const pppUptime = formatUptime(getParameterWithPaths(device, [
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.UpTime',
            'Device.PPP.Interface.1.UpTime'
        ])) || 'N/A';

        const lastInform = device._lastInform;
        const firstInform = device._registered || device._created || 'N/A';

        let message = `📊 *CONNECTION HISTORY*\n\n`;
        message += `⏰ *Uptime:*\n`;
        message += `• Device Uptime: ${deviceUptime}\n`;
        message += `• PPPoE Uptime: ${pppUptime}\n\n`;

        message += `📅 *History:*\n`;
        message += `• First Registered: ${firstInform !== 'N/A' ? new Date(firstInform).toLocaleString() : 'N/A'}\n`;
        message += `• Last Inform: ${new Date(lastInform).toLocaleString()}\n\n`;

        // Calculate connection stability
        const now = Date.now();
        const lastInformTime = new Date(lastInform).getTime();
        const timeDiff = now - lastInformTime;

        message += `🔄 *Connection Status:*\n`;
        if (timeDiff < 5 * 60 * 1000) { // 5 minutes
            message += `• Status: 🟢 Stable (Last inform ${Math.round(timeDiff / 1000)} seconds ago)\n`;
        } else if (timeDiff < 30 * 60 * 1000) { // 30 minutes
            message += `• Status: 🟡 Normal (Last inform ${Math.round(timeDiff / 60000)} minutes ago)\n`;
        } else {
            message += `• Status: 🔴 Problem (Last inform ${Math.round(timeDiff / 60000)} minutes ago)\n`;
        }

        await sock.sendMessage(remoteJid, {
            text: formatResponse(message)
        });

    } catch (error) {
        logger.error(`Error handling connection history: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(`❌ An error occurred: ${error.message}`)
        });
    }
}

// Helper function to format bytes
function formatBytes(bytes) {
    if (bytes === 'N/A' || !bytes) return 'N/A';

    const num = parseInt(bytes);
    if (isNaN(num)) return bytes;

    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (num === 0) return '0 Bytes';

    const i = Math.floor(Math.log(num) / Math.log(1024));
    return Math.round(num / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
    setSock,
    handleWifiInfo,
    handleChangeWifiSSID,
    handleChangeWifiPassword,
    handleDeviceStatus,
    handleRestartDevice,
    handleRestartConfirmation,
    handleFactoryReset,
    handleFactoryResetConfirmation,
    handleConnectedDevices,
    handleAdminDeviceDetail,
    handleAdminRestartDevice,
    handleAdminFactoryReset,
    handleAdminFactoryResetConfirmation,
    handleSpeedTest,
    handleNetworkDiagnostic,
    handleConnectionHistory
};
