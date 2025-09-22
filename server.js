// WebSocket to OSC Bridge Server
// Receives data from phone controllers and forwards as OSC messages
// 
// Installation:
// npm install ws osc-js
//
// Usage:
// node bridge.mjs (note the .mjs extension for ES modules)
//
// Or add "type": "module" to package.json and use bridge.js

import { WebSocketServer } from 'ws';
import OSC from 'osc-js';

// Configuration
const WS_PORT = 8080;          // WebSocket server port
const OSC_SEND_PORT = 7000;    // OSC output port (TouchDesigner default)
const OSC_SEND_HOST = '127.0.0.1';

// Create OSC client
const osc = new OSC({
    plugin: new OSC.DatagramPlugin({ 
        send: { 
            port: OSC_SEND_PORT, 
            host: OSC_SEND_HOST 
        }
    })
});

// Open OSC connection
osc.open();

// Create WebSocket server
const wss = new WebSocketServer({ port: WS_PORT });

// Track connected devices
const devices = new Map();

console.log(`WebSocket to OSC Bridge Started`);
console.log(`Phones connect to: ws://<your-ip>:${WS_PORT}`);
console.log(`Sending OSC to: ${OSC_SEND_HOST}:${OSC_SEND_PORT}`);
console.log(`\nWaiting for connections...\n`);

// Handle WebSocket connections
wss.on('connection', (ws) => {
    let deviceId = null;
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            // Handle different message types
            switch(message.type) {
                case 'connect':
                    deviceId = message.deviceId;
                    devices.set(deviceId, {
                        color: message.color,
                        connected: Date.now()
                    });
                    console.log(`Device connected: ${deviceId} (Color: ${message.color})`);
                    
                    // Send OSC notification of new device
                    osc.send(new OSC.Message('/device/connected', 
                        deviceId, 
                        message.color / 360.0  // Normalize hue to 0-1
                    ));
                    break;
                    
                case 'orientation':
                    // Send tilt data as OSC
                    // Normalize values for TouchDesigner
                    const normalizedX = (message.tiltX + 180) / 360;  // 0-1
                    const normalizedY = (message.tiltY + 90) / 180;   // 0-1
                    const normalizedRotate = message.rotate / 360;    // 0-1
                    
                    osc.send(new OSC.Message(`/${deviceId}/tiltX`, normalizedX));
                    osc.send(new OSC.Message(`/${deviceId}/tiltY`, normalizedY));
                    osc.send(new OSC.Message(`/${deviceId}/rotate`, normalizedRotate));
                    
                    // Also send a combined message
                    osc.send(new OSC.Message(`/${deviceId}/orientation`, 
                        normalizedX, 
                        normalizedY, 
                        normalizedRotate
                    ));
                    
                    // Debug output (comment out for production)
                    console.log(`${deviceId} tilt: X=${message.tiltX}° Y=${message.tiltY}°`);
                    break;
                    
                case 'touch':
                    // Send touch data as OSC
                    osc.send(new OSC.Message(`/${deviceId}/touchX`, message.x));
                    osc.send(new OSC.Message(`/${deviceId}/touchY`, message.y));
                    osc.send(new OSC.Message(`/${deviceId}/touches`, message.touches));
                    
                    // Combined touch message
                    osc.send(new OSC.Message(`/${deviceId}/touch`, 
                        message.x, 
                        message.y, 
                        message.touches
                    ));
                    
                    if (message.touches > 0) {
                        console.log(`${deviceId} touch: ${Math.round(message.x * 100)}%, ${Math.round(message.y * 100)}%`);
                    }
                    break;
            }
            
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        if (deviceId) {
            console.log(`Device disconnected: ${deviceId}`);
            devices.delete(deviceId);
            
            // Send OSC notification of disconnect
            osc.send(new OSC.Message('/device/disconnected', deviceId));
        }
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for ${deviceId}:`, error.message);
    });
});

// Periodically send device count
setInterval(() => {
    osc.send(new OSC.Message('/devices/count', devices.size));
    if (devices.size > 0) {
        console.log(`Active devices: ${devices.size}`);
    }
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down bridge...');
    wss.close();
    osc.close();
    process.exit();
});