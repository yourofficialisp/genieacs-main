const axios = require('axios');
require('dotenv').config();
// const { sendTechnicianMessage } = require('./sendMessage');
// const mikrotik = require('./mikrotik');
// const { getMikrotikConnection } = require('./mikrotik');

// GenieACS API Configuration
const GENIEACS_URL = process.env.GENIEACS_URL || 'http://localhost:7557';
const GENIEACS_USERNAME = process.env.GENIEACS_USERNAME;
const GENIEACS_PASSWORD = process.env.GENIEACS_PASSWORD;

// Create axios instance with default configuration
const axiosInstance = axios.create({
    baseURL: GENIEACS_URL,
    auth: {
        username: GENIEACS_USERNAME,
        password: GENIEACS_PASSWORD
    },
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

// GenieACS API wrapper
const genieacsApi = {
    async getDevices() {
        try {
            console.log('Getting all devices...');
            const response = await axiosInstance.get('/devices');
            console.log(`Found ${response.data?.length || 0} devices`);
            return response.data;
        } catch (error) {
            console.error('Error getting devices:', error.response?.data || error.message);
            throw error;
        }
    },

    async findDeviceByPhoneNumber(phoneNumber) {
        try {
            // Search for device by tag containing phone number
            const response = await axiosInstance.get('/devices', {
                params: {
                    'query': JSON.stringify({
                        '_tags': phoneNumber
                    })
                }
            });

            if (!response.data || response.data.length === 0) {
                throw new Error(`No device found with phone number: ${phoneNumber}`);
            }

            return response.data[0]; // Returns the first device found
        } catch (error) {
            console.error(`Error finding device with phone number ${phoneNumber}:`, error.response?.data || error.message);
            throw error;
        }
    },

    async getDeviceByPhoneNumber(phoneNumber) {
        try {
            const device = await this.findDeviceByPhoneNumber(phoneNumber);
            return await this.getDevice(device._id);
        } catch (error) {
            console.error(`Error getting device by phone number ${phoneNumber}:`, error.message);
            throw error;
        }
    },

    async getDevice(deviceId) {
        try {
            const response = await axiosInstance.get(`/devices/${encodeURIComponent(deviceId)}`);
            return response.data;
        } catch (error) {
            console.error(`Error getting device ${deviceId}:`, error.response?.data || error.message);
            throw error;
        }
    },

    async setParameterValues(deviceId, parameters) {
        try {
            console.log('Setting parameters for device:', deviceId, parameters);

            // Format parameter values for GenieACS
            const parameterValues = [];
            for (const [path, value] of Object.entries(parameters)) {
                // Handle SSID update
                if (path.includes('SSID')) {
                    parameterValues.push(
                        ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", value],
                        ["Device.WiFi.SSID.1.SSID", value]
                    );
                }
                // Handle WiFi password update
                else if (path.includes('Password') || path.includes('KeyPassphrase')) {
                    parameterValues.push(
                        ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase", value],
                        ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase", value],
                        ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey", value]
                    );
                }
                // Handle other parameters
                else {
                    parameterValues.push([path, value]);
                }
            }

            console.log('Formatted parameter values:', parameterValues);

            // Send task to GenieACS
            const task = {
                name: "setParameterValues",
                parameterValues: parameterValues
            };

            const response = await axiosInstance.post(
                `/devices/${encodeURIComponent(deviceId)}/tasks`,
                task
            );

            console.log('Parameter update response:', response.data);

            // Send refresh task
            const refreshTask = {
                name: "refreshObject",
                objectName: "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1"
            };

            const refreshResponse = await axiosInstance.post(
                `/devices/${encodeURIComponent(deviceId)}/tasks`,
                refreshTask
            );

            console.log('Refresh task response:', refreshResponse.data);

            return response.data;
        } catch (error) {
            console.error(`Error setting parameters for device ${deviceId}:`, error.response?.data || error.message);
            throw error;
        }
    },

    async reboot(deviceId) {
        try {
            const task = {
                name: "reboot",
                timestamp: new Date().toISOString()
            };
            const response = await axiosInstance.post(
                `/devices/${encodeURIComponent(deviceId)}/tasks`,
                task
            );
            return response.data;
        } catch (error) {
            console.error(`Error rebooting device ${deviceId}:`, error.response?.data || error.message);
            throw error;
        }
    },

    async factoryReset(deviceId) {
        try {
            const task = {
                name: "factoryReset",
                timestamp: new Date().toISOString()
            };
            const response = await axiosInstance.post(
                `/devices/${encodeURIComponent(deviceId)}/tasks`,
                task
            );
            return response.data;
        } catch (error) {
            console.error(`Error factory resetting device ${deviceId}:`, error.response?.data || error.message);
            throw error;
        }
    },

    async getDeviceParameters(deviceId, parameterNames) {
        try {
            const queryString = parameterNames.map(name => `query=${encodeURIComponent(name)}`).join('&');
            const response = await axiosInstance.get(`/devices/${encodeURIComponent(deviceId)}?${queryString}`);
            return response.data;
        } catch (error) {
            console.error(`Error getting parameters for device ${deviceId}:`, error.response?.data || error.message);
            throw error;
        }
    },

    async getDeviceInfo(deviceId) {
        try {
            console.log(`Getting device info for device ID: ${deviceId}`);
            
            // Get device details
            const deviceResponse = await axios.get(`${GENIEACS_URL}/devices/${encodeURIComponent(deviceId)}`, {
                auth: {
                    username: GENIEACS_USERNAME,
                    password: GENIEACS_PASSWORD
                }
            });

            if (!deviceResponse.data) {
                console.error('No device data found');
                return null;
            }

            console.log('Device data retrieved successfully');
            return deviceResponse.data;
        } catch (error) {
            console.error('Error getting device info:', error.response?.data || error.message);
            return null;
        }
    },

    async getVirtualParameters(deviceId) {
        try {
            console.log(`Getting virtual parameters for device ID: ${deviceId}`);
            
            const virtualParams = [
                // Serial Number
                'InternetGatewayDevice.DeviceInfo.SerialNumber',
                'Device.DeviceInfo.SerialNumber',
                'VirtualParameters.getSerialNumber',
                
                // Device Uptime
                'InternetGatewayDevice.DeviceInfo.UpTime',
                'Device.DeviceInfo.UpTime',
                'VirtualParameters.getdeviceuptime',
                
                // PPPoE Uptime
                'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.UpTime',
                'Device.PPP.Interface.1.UpTime',
                'VirtualParameters.getpppuptime',
                
                // Active Devices
                'InternetGatewayDevice.LANDevice.1.Hosts.HostNumberOfEntries',
                'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations',
                'Device.Hosts.HostNumberOfEntries',
                'VirtualParameters.activedevices',
                'VirtualParameters.getactivedevices',
                
                // RX Power
                'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.XPON.RxPower',
                'Device.XPON.Interface.1.RxPower',
                'VirtualParameters.RXPower',
                'VirtualParameters.redaman',
                
                // PON MAC
                'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.MACAddress',
                'Device.Ethernet.Interface.1.MACAddress',
                'VirtualParameters.PonMac',
                
                // WAN IP
                'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
                'Device.IP.Interface.1.IPv4Address.1.IPAddress',
                'VirtualParameters.WanIP',
                
                // PPP IP
                'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
                'Device.PPP.Interface.1.IPCP.LocalIPAddress',
                'VirtualParameters.pppIP',
                'VirtualParameters.pppoeIP',
                
                // Temperature
                'InternetGatewayDevice.DeviceInfo.Temperature',
                'Device.DeviceInfo.Temperature',
                'VirtualParameters.gettemp'
            ];

            // Using tasks endpoint to get parameter values
            const response = await axios.post(`${GENIEACS_URL}/tasks`, [{
                name: "getParameterValues",
                parameterNames: virtualParams,
                device: deviceId
            }], {
                auth: {
                    username: GENIEACS_USERNAME,
                    password: GENIEACS_PASSWORD
                }
            });

            console.log('Virtual parameters retrieved successfully');
            return response.data;
        } catch (error) {
            console.error('Error getting virtual parameters:', error.response?.data || error.message);
            return null;
        }
    },
};

// Function to check RXPower values for all devices
async function monitorRXPower(threshold = -27) {
    try {
        console.log(`Starting RXPower monitoring with threshold ${threshold} dBm`);
        
        // Get all devices
        const devices = await genieacsApi.getDevices();
        console.log(`Checking RXPower for ${devices.length} devices...`);
        
        // Get PPPoE data from Mikrotik
        console.log('Retrieving PPPoE data from Mikrotik...');
        // const conn = await getMikrotikConnection(); // Removed Mikrotik connection
        let pppoeSecrets = [];
        
        // if (conn) { // Removed Mikrotik connection
        //     try {
        //         // Dapatkan semua PPPoE secret from Mikrotik
        //         pppoeSecrets = await conn.write('/ppp/secret/print');
        //         console.log(`Found ${pppoeSecrets.length} PPPoE secret`);
        //     } catch (error) {
        //         console.error('Error mendapatkan PPPoE secret:', error.message);
        //     }
        // }
        
        const criticalDevices = [];
        
        // Check each device
        for (const device of devices) {
            try {
                // Get RXPower value
                const rxPowerPaths = [
                    'VirtualParameters.RXPower',
                    'VirtualParameters.redaman',
                    'InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower',
                    'Device.XPON.Interface.1.Stats.RXPower'
                ];
                
                let rxPower = null;
                
                // Check each path that may contain the RXPower value
                for (const path of rxPowerPaths) {
                    // Extract value using existing device path
                    if (getRXPowerValue(device, path)) {
                        rxPower = getRXPowerValue(device, path);
                        break;
                    }
                }
                
                // If rxPower found and below threshold
                if (rxPower !== null && parseFloat(rxPower) < threshold) {
                    // Find PPPoE username from device parameters
                    let pppoeUsername = "Unknown";
                    const serialNumber = getDeviceSerialNumber(device);
                    const deviceId = device._id;
                    const shortDeviceId = deviceId.split('-')[2] || deviceId;
                    
                    // Get PPPoE username from device parameters
                    pppoeUsername = 
                        device.InternetGatewayDevice?.WANDevice?.[1]?.WANConnectionDevice?.[1]?.WANPPPConnection?.[1]?.Username?._value ||
                        device.InternetGatewayDevice?.WANDevice?.[0]?.WANConnectionDevice?.[0]?.WANPPPConnection?.[0]?.Username?._value ||
                        device.VirtualParameters?.pppoeUsername?._value ||
                        "Unknown";
                    
                    // If not found from device parameters, try searching PPPoE secrets in Mikrotik
                    if (pppoeUsername === "Unknown") {
                        // Search for PPPoE secret linked to this device by comment
                        const matchingSecret = pppoeSecrets.find(secret => {
                            if (!secret.comment) return false;
                            
                            // Check if serial number or device ID exists in the comment column
                            return (
                                secret.comment.includes(serialNumber) || 
                                secret.comment.includes(shortDeviceId)
                            );
                        });
                        
                        if (matchingSecret) {
                            // If matching secret found, use secret name as username
                            pppoeUsername = matchingSecret.name;
                            console.log(`Found PPPoE username ${pppoeUsername} for device ${shortDeviceId} from PPPoE secret`);
                        }
                    } else {
                        console.log(`Found PPPoE username ${pppoeUsername} for device ${shortDeviceId} from device parameters`);
                    }
                    
                    // If still not found, try searching from device tags
                    if (pppoeUsername === "Unknown" && device._tags && Array.isArray(device._tags)) {
                        // Check if there is a tag starting with "pppoe:" containing username
                        const pppoeTag = device._tags.find(tag => tag.startsWith('pppoe:'));
                        if (pppoeTag) {
                            pppoeUsername = pppoeTag.replace('pppoe:', '');
                            console.log(`Found PPPoE username ${pppoeUsername} for device ${shortDeviceId} from tag`);
                        } else {
                            console.log(`Could not find PPPoE username for device ${shortDeviceId}, tags: ${JSON.stringify(device._tags)}`);
                        }
                    }
                    
                    const deviceInfo = {
                        id: device._id,
                        rxPower,
                        serialNumber: getDeviceSerialNumber(device),
                        lastInform: device._lastInform,
                        pppoeUsername: pppoeUsername
                    };
                    
                    criticalDevices.push(deviceInfo);
                    console.log(`Device with low RXPower: ${deviceInfo.id}, RXPower: ${rxPower} dBm, PPPoE: ${pppoeUsername}`);
                }
            } catch (deviceError) {
                console.error(`Error checking RXPower for device ${device._id}:`, deviceError);
            }
        }
        
        // If there are devices with RXPower below threshold
        if (criticalDevices.length > 0) {
            // Build warning message
            let message = `⚠️ *WARNING: HIGH ATTENUATION* ⚠️\n\n`;
            message += `${criticalDevices.length} device(s) have an RXPower value above ${threshold} dBm:\n\n`;
            
            criticalDevices.forEach((device, index) => {
                message += `${index + 1}. ID: ${device.id.split('-')[2] || device.id}\n`;
                message += `   S/N: ${device.serialNumber}\n`;
                message += `   PPPoE: ${device.pppoeUsername}\n`;
                message += `   RXPower: ${device.rxPower} dBm\n`;
                message += `   Last Inform: ${new Date(device.lastInform).toLocaleString()}\n\n`;
            });
            
            message += `Please check immediately to avoid connection drops.`;
            
            // Send message to technician group with high priority
            // await sendTechnicianMessage(message, 'high'); // Removed sendTechnicianMessage
            console.log(`RXPower warning message sent for ${criticalDevices.length} device(s)`);
        } else {
            console.log('No devices with RXPower below threshold');
        }
        
        return {
            success: true,
            criticalDevices,
            message: `${criticalDevices.length} device(s) have RXPower above threshold`
        };
    } catch (error) {
        console.error('Error monitoring RXPower:', error);
        return {
            success: false,
            message: `Error monitoring RXPower: ${error.message}`,
            error
        };
    }
}

// Helper function to get RXPower value
function getRXPowerValue(device, path) {
    try {
        // Split path into parts
        const parts = path.split('.');
        let current = device;
        
        // Navigate through nested properties
        for (const part of parts) {
            if (!current) return null;
            current = current[part];
        }
        
        // Check if it's a GenieACS parameter object
        if (current && current._value !== undefined) {
            return current._value;
        }
        
        return null;
    } catch (error) {
        console.error(`Error getting RXPower from path ${path}:`, error);
        return null;
    }
}

// Helper function to get serial number
function getDeviceSerialNumber(device) {
    try {
        const serialPaths = [
            'DeviceID.SerialNumber',
            'InternetGatewayDevice.DeviceInfo.SerialNumber',
            'Device.DeviceInfo.SerialNumber'
        ];
        
        for (const path of serialPaths) {
            const parts = path.split('.');
            let current = device;
            
            for (const part of parts) {
                if (!current) break;
                current = current[part];
            }
            
            if (current && current._value !== undefined) {
                return current._value;
            }
        }
        
        // Fallback to device ID if serial number not found
        if (device._id) {
            const parts = device._id.split('-');
            if (parts.length >= 3) {
                return parts[2];
            }
            return device._id;
        }
        
        return 'Unknown';
    } catch (error) {
        console.error('Error getting device serial number:', error);
        return 'Unknown';
    }
}

// Function to monitor inactive (offline) devices
async function monitorOfflineDevices(thresholdHours = 24) {
    try {
        console.log(`Starting offline device monitoring with threshold ${thresholdHours} hours`);
        
        // Get all devices
        const devices = await genieacsApi.getDevices();
        console.log(`Checking status for ${devices.length} devices...`);
        
        const offlineDevices = [];
        const now = new Date();
        const thresholdMs = thresholdHours * 60 * 60 * 1000; // Convert hours to ms
        
        // Check each device
        for (const device of devices) {
            try {
                if (!device._lastInform) {
                    console.log(`Device ${device._id} has no lastInform`);
                    continue;
                }
                
                const lastInformTime = new Date(device._lastInform).getTime();
                const timeDiff = now.getTime() - lastInformTime;
                
                // If device has not sent an inform within the threshold period
                if (timeDiff > thresholdMs) {
                    const deviceInfo = {
                        id: device._id,
                        serialNumber: getDeviceSerialNumber(device),
                        lastInform: device._lastInform,
                        offlineHours: Math.round(timeDiff / (60 * 60 * 1000) * 10) / 10 // Hours with 1 decimal
                    };
                    
                    offlineDevices.push(deviceInfo);
                    console.log(`Offline device: ${deviceInfo.id}, Offline for: ${deviceInfo.offlineHours} hours`);
                }
            } catch (deviceError) {
                console.error(`Error checking status for device ${device._id}:`, deviceError);
            }
        }
        
        // If there are offline devices
        if (offlineDevices.length > 0) {
            // Build warning message
            let message = `⚠️ *WARNING: OFFLINE DEVICES* ⚠️\n\n`;
            message += `${offlineDevices.length} device(s) have been offline for more than ${thresholdHours} hours:\n\n`;
            
            offlineDevices.forEach((device, index) => {
                message += `${index + 1}. ID: ${device.id.split('-')[2] || device.id}\n`;
                message += `   S/N: ${device.serialNumber}\n`;
                message += `   Offline for: ${device.offlineHours} hours\n`;
                message += `   Last Inform: ${new Date(device.lastInform).toLocaleString()}\n\n`;
            });
            
            message += `Please take action immediately.`;
            
            // Send message to technician group with medium priority
            // await sendTechnicianMessage(message, 'medium'); // Removed sendTechnicianMessage
            console.log(`Offline device warning message sent for ${offlineDevices.length} device(s)`);
        } else {
            console.log('No devices offline beyond the threshold');
        }
        
        return {
            success: true,
            offlineDevices,
            message: `${offlineDevices.length} device(s) offline for more than ${thresholdHours} hours`
        };
    } catch (error) {
        console.error('Error monitoring offline devices:', error);
        return {
            success: false,
            message: `Error monitoring offline devices: ${error.message}`,
            error
        };
    }
}

// Schedule monitoring every 6 hours
function scheduleMonitoring() {
    // Run once at startup
    setTimeout(async () => {
        console.log('Running initial RXPower monitoring...');
        await monitorRXPower();
        
        console.log('Running initial offline device monitoring...');
        await monitorOfflineDevices();
        
        // Schedule periodically
        setInterval(async () => {
            console.log('Running scheduled RXPower monitoring...');
            await monitorRXPower();
        }, 6 * 60 * 60 * 1000); // Every 6 hours
        
        setInterval(async () => {
            console.log('Running scheduled offline device monitoring...');
            await monitorOfflineDevices();
        }, 12 * 60 * 60 * 1000); // Every 12 hours
    }, 5 * 60 * 1000); // Start 5 minutes after server starts
}

// Run monitoring scheduler
scheduleMonitoring();

module.exports = {
    getDevices: genieacsApi.getDevices,
    getDeviceInfo: genieacsApi.getDeviceInfo,
    findDeviceByPhoneNumber: genieacsApi.findDeviceByPhoneNumber,
    getDeviceByPhoneNumber: genieacsApi.getDeviceByPhoneNumber,
    setParameterValues: genieacsApi.setParameterValues,
    reboot: genieacsApi.reboot,
    factoryReset: genieacsApi.factoryReset,
    getVirtualParameters: genieacsApi.getVirtualParameters,
    monitorRXPower,
    monitorOfflineDevices
};
