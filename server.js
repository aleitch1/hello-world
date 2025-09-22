// WebSocket to OSC Bridge Server with HTTP - Railway Compatible
// Serves phone controller HTML and handles WebSocket connections
// 
// Installation:
// npm install ws osc-js express
//
// Usage:
// node server.js

import { WebSocketServer } from 'ws';
import OSC from 'osc-js';
import express from 'express';
import { createServer } from 'http';

// Configuration - Railway compatible
const PORT = process.env.PORT || 8080;
const OSC_SEND_PORT = 7000;    // OSC output port (TouchDesigner default)
const OSC_SEND_HOST = '127.0.0.1';

// Detect deployment environment
const IS_RAILWAY = process.env.RAILWAY_ENVIRONMENT_NAME !== undefined;
const IS_RENDER = process.env.RENDER !== undefined;
const IS_HEROKU = process.env.DYNO !== undefined;
const IS_CLOUD = IS_RAILWAY || IS_RENDER || IS_HEROKU;

// Determine base URL for auto-connection
let BASE_URL;
if (IS_RAILWAY) {
    BASE_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || 'your-app.up.railway.app'}`;
} else if (IS_RENDER) {
    BASE_URL = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
} else if (IS_HEROKU) {
    BASE_URL = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
} else {
    BASE_URL = `http://localhost:${PORT}`;
}

const WS_URL = BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');

// Create Express app and HTTP server
const app = express();
const server = createServer(app);

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

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Track connected devices with detailed info
const devices = new Map();
let totalConnections = 0;
let totalMessages = 0;
const serverStartTime = Date.now();

// Utility function for timestamped logging
const log = (message, level = 'INFO') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
};

// Phone Controller HTML (auto-connecting version)
const phoneControllerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Phone Controller</title>
    <style>
        :root {
            --user-hue: 0;
            --bg-color: hsl(var(--user-hue), 70%, 50%);
            --text-color: white;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            transition: background 0.3s ease;
        }

        #status {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 2rem;
            text-align: center;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        #info {
            background: rgba(0,0,0,0.2);
            padding: 1.5rem;
            border-radius: 1rem;
            width: 90%;
            max-width: 400px;
            backdrop-filter: blur(10px);
        }

        .data-row {
            display: flex;
            justify-content: space-between;
            margin: 0.5rem 0;
            font-size: 1.2rem;
        }

        .data-label {
            opacity: 0.9;
        }

        .data-value {
            font-weight: bold;
            font-family: monospace;
            min-width: 80px;
            text-align: right;
        }

        #touch-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
        }

        .touch-point {
            position: absolute;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: rgba(255,255,255,0.5);
            transform: translate(-50%, -50%);
            pointer-events: none;
            animation: pulse 0.5s ease-out;
        }

        @keyframes pulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
            100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }

        #connect-btn {
            margin-top: 1rem;
            padding: 0.75rem 2rem;
            font-size: 1.2rem;
            border: none;
            border-radius: 0.5rem;
            background: rgba(0,0,0,0.3);
            color: white;
            cursor: pointer;
            width: 100%;
            font-weight: bold;
            transition: background 0.2s;
        }

        #connect-btn:active {
            background: rgba(0,0,0,0.5);
        }

        .hidden {
            display: none !important;
        }

        #error {
            background: rgba(255,0,0,0.3);
            padding: 1rem;
            border-radius: 0.5rem;
            margin-top: 1rem;
            text-align: center;
        }

        #device-id {
            text-align: center;
            font-size: 0.9rem;
            opacity: 0.8;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div id="status">READY TO CONNECT</div>
    
    <div id="info">
        <div id="connection-form">
            <button id="connect-btn">CONNECT TO SHOW</button>
            <div id="device-id"></div>
        </div>
        
        <div id="sensor-data" class="hidden">
            <div class="data-row">
                <span class="data-label">Tilt X:</span>
                <span class="data-value" id="tilt-x">0°</span>
            </div>
            <div class="data-row">
                <span class="data-label">Tilt Y:</span>
                <span class="data-value" id="tilt-y">0°</span>
            </div>
            <div class="data-row">
                <span class="data-label">Rotate:</span>
                <span class="data-value" id="rotate">0°</span>
            </div>
            <div class="data-row">
                <span class="data-label">Touch:</span>
                <span class="data-value" id="touch-pos">none</span>
            </div>
            <div id="device-id"></div>
        </div>
        
        <div id="error" class="hidden"></div>
    </div>
    
    <div id="touch-area"></div>

    <script>
        // Generate unique color and device ID
        const userHue = Date.now() % 360;
        const deviceId = \`user-\${Math.floor(Math.random() * 1000)}-\${Date.now().toString(36).slice(-4)}\`;
        
        document.documentElement.style.setProperty('--user-hue', userHue);
        document.getElementById('device-id').textContent = \`Device: \${deviceId}\`;
        
        let socket = null;
        let lastData = {};
        
        // UI Elements
        const statusEl = document.getElementById('status');
        const connectBtn = document.getElementById('connect-btn');
        const connectionForm = document.getElementById('connection-form');
        const sensorData = document.getElementById('sensor-data');
        const errorEl = document.getElementById('error');
        
        // Auto-detect WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = \`\${protocol}//\${window.location.host}\`;
        
        // Connect button handler
        connectBtn.addEventListener('click', connect);
        
        // Auto-connect on page load
        setTimeout(() => {
            if (!socket) connect();
        }, 1000);
        
        function connect() {
            statusEl.textContent = 'CONNECTING...';
            errorEl.classList.add('hidden');
            
            try {
                socket = new WebSocket(wsUrl);
                
                socket.onopen = () => {
                    statusEl.textContent = 'CONNECTED';
                    connectionForm.classList.add('hidden');
                    sensorData.classList.remove('hidden');
                    
                    // Send initial handshake
                    sendData({
                        type: 'connect',
                        deviceId: deviceId,
                        color: userHue
                    });
                    
                    // Start sensor listening
                    startSensors();
                };
                
                socket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === 'ping') {
                            console.log('Server ping:', message.message);
                        }
                    } catch (e) {
                        console.log('Non-JSON message:', event.data);
                    }
                };
                
                socket.onclose = (event) => {
                    statusEl.textContent = 'DISCONNECTED';
                    connectionForm.classList.remove('hidden');
                    sensorData.classList.add('hidden');
                    socket = null;
                    
                    // Auto-reconnect after 3 seconds
                    setTimeout(() => {
                        if (!socket) {
                            connect();
                        }
                    }, 3000);
                };
                
                socket.onerror = (error) => {
                    showError('Connection failed. Retrying...');
                    statusEl.textContent = 'CONNECTION ERROR';
                };
                
            } catch (error) {
                showError('Connection error: ' + error.message);
                statusEl.textContent = 'ERROR';
            }
        }
        
        function showError(message) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            setTimeout(() => {
                errorEl.classList.add('hidden');
            }, 3000);
        }
        
        function sendData(data) {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    ...data,
                    deviceId: deviceId,
                    timestamp: Date.now()
                }));
            }
        }
        
        function startSensors() {
            // Request permissions and start device orientation
            if (typeof DeviceOrientationEvent !== 'undefined') {
                if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                    // iOS 13+ requires permission
                    DeviceOrientationEvent.requestPermission()
                        .then(response => {
                            if (response === 'granted') {
                                addOrientationListener();
                            } else {
                                showError('Motion permission denied');
                            }
                        })
                        .catch(console.error);
                } else {
                    // Non-iOS or older iOS
                    addOrientationListener();
                }
            }
            
            // Touch events
            document.addEventListener('touchstart', handleTouch);
            document.addEventListener('touchmove', handleTouch);
            document.addEventListener('touchend', handleTouchEnd);
        }
        
        function addOrientationListener() {
            window.addEventListener('deviceorientation', (e) => {
                const tiltX = Math.round(e.beta || 0);  // -180 to 180
                const tiltY = Math.round(e.gamma || 0); // -90 to 90
                const rotate = Math.round(e.alpha || 0); // 0 to 360
                
                // Update display
                document.getElementById('tilt-x').textContent = \`\${tiltX}°\`;
                document.getElementById('tilt-y').textContent = \`\${tiltY}°\`;
                document.getElementById('rotate').textContent = \`\${rotate}°\`;
                
                // Only send if changed significantly
                if (Math.abs((lastData.tiltX || 0) - tiltX) > 2 || 
                    Math.abs((lastData.tiltY || 0) - tiltY) > 2 || 
                    Math.abs((lastData.rotate || 0) - rotate) > 2) {
                    
                    lastData = { tiltX, tiltY, rotate };
                    sendData({
                        type: 'orientation',
                        tiltX: tiltX,
                        tiltY: tiltY,
                        rotate: rotate
                    });
                }
            });
        }
        
        function handleTouch(e) {
            e.preventDefault();
            const touch = e.touches[0];
            const x = touch.clientX / window.innerWidth;
            const y = touch.clientY / window.innerHeight;
            
            // Update display
            document.getElementById('touch-pos').textContent = 
                \`\${Math.round(x * 100)}%, \${Math.round(y * 100)}%\`;
            
            // Visual feedback
            const point = document.createElement('div');
            point.className = 'touch-point';
            point.style.left = touch.clientX + 'px';
            point.style.top = touch.clientY + 'px';
            document.getElementById('touch-area').appendChild(point);
            setTimeout(() => point.remove(), 500);
            
            // Send data
            sendData({
                type: 'touch',
                x: x,
                y: y,
                touches: e.touches.length
            });
        }
        
        function handleTouchEnd(e) {
            if (e.touches.length === 0) {
                document.getElementById('touch-pos').textContent = 'none';
                sendData({
                    type: 'touch',
                    x: 0,
                    y: 0,
                    touches: 0
                });
            }
        }
    </script>
</body>
</html>`;

// Status page HTML
const statusPageHTML = (devices, totalConnections, totalMessages, serverStartTime) => {
    const uptime = ((Date.now() - serverStartTime) / 1000 / 60).toFixed(1);
    const deviceList = Array.from(devices.entries()).map(([id, device]) => {
        const duration = ((Date.now() - device.connected) / 1000).toFixed(0);
        return `<tr>
            <td>${id}</td>
            <td style="background: hsl(${device.color}, 70%, 50%); width: 20px; height: 20px; border-radius: 50%;"></td>
            <td>${device.color}°</td>
            <td>${device.messageCount}</td>
            <td>${duration}s</td>
            <td>${device.clientIP}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
    <title>Server Status</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: monospace; margin: 2rem; background: #1a1a1a; color: #fff; }
        .stats { background: #2a2a2a; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
        .stats h3 { margin-top: 0; color: #4CAF50; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #444; }
        th { background: #333; }
        .refresh { margin: 1rem 0; }
        .refresh button { padding: 0.5rem 1rem; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .url { background: #333; padding: 0.5rem; border-radius: 4px; font-family: monospace; }
    </style>
    <script>
        setTimeout(() => location.reload(), 5000);
    </script>
</head>
<body>
    <h1>WebSocket to OSC Bridge Status</h1>
    
    <div class="stats">
        <h3>Server Info</h3>
        <p>Uptime: ${uptime} minutes</p>
        <p>Environment: ${IS_CLOUD ? 'CLOUD' : 'LOCAL'}</p>
        <p>Total Connections: ${totalConnections}</p>
        <p>Total Messages: ${totalMessages}</p>
        <p>OSC Output: ${OSC_SEND_HOST}:${OSC_SEND_PORT}</p>
    </div>
    
    <div class="stats">
        <h3>Connection URLs</h3>
        <p>Phone Controller: <span class="url">${BASE_URL}</span></p>
        <p>WebSocket: <span class="url">${WS_URL}</span></p>
    </div>
    
    <div class="stats">
        <h3>Active Devices (${devices.size})</h3>
        ${devices.size > 0 ? `
        <table>
            <tr>
                <th>Device ID</th>
                <th>Color</th>
                <th>Hue</th>
                <th>Messages</th>
                <th>Duration</th>
                <th>IP</th>
            </tr>
            ${deviceList}
        </table>
        ` : '<p>No devices connected</p>'}
    </div>
    
    <div class="refresh">
        <button onclick="location.reload()">Refresh Now</button>
        <span>Auto-refresh every 5 seconds</span>
    </div>
</body>
</html>`;
};

// HTTP Routes
app.get('/', (req, res) => {
    res.send(phoneControllerHTML);
});

app.get('/status', (req, res) => {
    res.send(statusPageHTML(devices, totalConnections, totalMessages, serverStartTime));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        uptime: Date.now() - serverStartTime,
        devices: devices.size,
        messages: totalMessages 
    });
});

// WebSocket connection handling (same as before)
wss.on('connection', (ws, request) => {
    const clientIP = request.socket.remoteAddress;
    const connectionId = `conn_${++totalConnections}`;
    let deviceId = null;
    let messageCount = 0;
    const connectTime = Date.now();
    
    log(`New WebSocket connection from ${clientIP} (ID: ${connectionId})`);
    
    ws.on('message', (data) => {
        try {
            messageCount++;
            totalMessages++;
            const message = JSON.parse(data);
            
            switch(message.type) {
                case 'connect':
                    deviceId = message.deviceId;
                    devices.set(deviceId, {
                        connectionId,
                        color: message.color,
                        connected: Date.now(),
                        messageCount: 0,
                        clientIP
                    });
                    
                    log(`Device registered: ${deviceId} (Color: ${message.color}°) from ${clientIP}`, 'CONNECT');
                    log(`Active devices: ${devices.size}`);
                    
                    osc.send(new OSC.Message('/device/connected', 
                        deviceId, 
                        message.color / 360.0
                    ));
                    break;
                    
                case 'orientation':
                    if (deviceId) {
                        devices.get(deviceId).messageCount++;
                        
                        const normalizedX = (message.tiltX + 180) / 360;
                        const normalizedY = (message.tiltY + 90) / 180;
                        const normalizedRotate = message.rotate / 360;
                        
                        osc.send(new OSC.Message(`/${deviceId}/tiltX`, normalizedX));
                        osc.send(new OSC.Message(`/${deviceId}/tiltY`, normalizedY));
                        osc.send(new OSC.Message(`/${deviceId}/rotate`, normalizedRotate));
                        osc.send(new OSC.Message(`/${deviceId}/orientation`, 
                            normalizedX, normalizedY, normalizedRotate
                        ));
                        
                        if (messageCount % 100 === 0) {
                            log(`${deviceId} orientation update (#${messageCount}): X=${message.tiltX.toFixed(1)}° Y=${message.tiltY.toFixed(1)}°`, 'DATA');
                        }
                    }
                    break;
                    
                case 'touch':
                    if (deviceId) {
                        devices.get(deviceId).messageCount++;
                        
                        osc.send(new OSC.Message(`/${deviceId}/touchX`, message.x));
                        osc.send(new OSC.Message(`/${deviceId}/touchY`, message.y));
                        osc.send(new OSC.Message(`/${deviceId}/touches`, message.touches));
                        osc.send(new OSC.Message(`/${deviceId}/touch`, 
                            message.x, message.y, message.touches
                        ));
                        
                        if (message.touches > 0) {
                            log(`${deviceId} touch: ${Math.round(message.x * 100)}%, ${Math.round(message.y * 100)}% (${message.touches} fingers)`, 'TOUCH');
                        }
                    }
                    break;
                    
                default:
                    log(`Unknown message type: ${message.type} from ${deviceId || connectionId}`, 'WARN');
                    break;
            }
            
        } catch (error) {
            log(`Error parsing message from ${deviceId || connectionId}: ${error.message}`, 'ERROR');
        }
    });
    
    ws.on('close', (code, reason) => {
        const duration = ((Date.now() - connectTime) / 1000).toFixed(1);
        
        if (deviceId) {
            log(`Device disconnected: ${deviceId} (${duration}s, ${messageCount} messages, code: ${code})`, 'DISCONNECT');
            devices.delete(deviceId);
            osc.send(new OSC.Message('/device/disconnected', deviceId));
        } else {
            log(`Connection closed: ${connectionId} (${duration}s, no device registered, code: ${code})`, 'DISCONNECT');
        }
        
        log(`Active devices: ${devices.size}`);
    });
    
    ws.on('error', (error) => {
        log(`WebSocket error for ${deviceId || connectionId}: ${error.message}`, 'ERROR');
    });
    
    try {
        ws.send(JSON.stringify({ type: 'ping', message: 'Connection established' }));
    } catch (error) {
        log(`Failed to send ping to ${connectionId}: ${error.message}`, 'ERROR');
    }
});

// Start server
server.listen(PORT, () => {
    log(`WebSocket to OSC Bridge Started`);
    log(`Environment: ${IS_CLOUD ? 'CLOUD' : 'LOCAL'}`);
    log(`Server running on port: ${PORT}`);
    log(`Phone controllers: ${BASE_URL}`);
    log(`Status page: ${BASE_URL}/status`);
    log(`WebSocket endpoint: ${WS_URL}`);
    log(`Sending OSC to: ${OSC_SEND_HOST}:${OSC_SEND_PORT}`);
    log(`Waiting for connections...`);
});

// Periodic status reporting
setInterval(() => {
    if (devices.size > 0) {
        log(`Status: ${devices.size} active devices, ${totalMessages} total messages processed`);
        devices.forEach((device, deviceId) => {
            const duration = ((Date.now() - device.connected) / 1000).toFixed(0);
            log(`  ${deviceId}: ${device.messageCount} msgs, ${duration}s connected, color ${device.color}°`);
        });
    }
    
    osc.send(new OSC.Message('/devices/count', devices.size));
}, 10000);

// Graceful shutdown
const shutdown = (signal) => {
    log(`Received ${signal}, shutting down gracefully...`);
    
    wss.clients.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
    });
    
    server.close(() => {
        log('HTTP server closed');
        osc.close();
        log('OSC connection closed');
        process.exit(0);
    });
    
    setTimeout(() => {
        log('Forced shutdown after timeout');
        process.exit(1);
    }, 5000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

log(`Process ID: ${process.pid}`);
log(`Node version: ${process.version}`);