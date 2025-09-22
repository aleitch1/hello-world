// P5 Live Sketch - Phone-Controlled Particle Clouds
// Connect to: wss://hello-world-production-bbc3.up.railway.app

let ws;
let devices = new Map();
let particles = new Map();
let connectionStatus = "Connecting...";

function connectToServer() {
  try {
    ws = new WebSocket('wss://hello-world-production-bbc3.up.railway.app');
    
    ws.onopen = () => {
      connectionStatus = "Connected - Waiting for phones...";
      console.log("Connected to server!");
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (e) {
        // Ignore non-JSON messages
      }
    };
    
    ws.onclose = () => {
      connectionStatus = "Disconnected - Reconnecting...";
      console.log("Disconnected, attempting reconnect...");
      setTimeout(connectToServer, 3000);
    };
    
    ws.onerror = (error) => {
      connectionStatus = "Connection Error";
      console.error("WebSocket error:", error);
    };
    
  } catch (error) {
    connectionStatus = "Failed to connect";
    console.error("Connection failed:", error);
    setTimeout(connectToServer, 5000);
  }
}

function handleServerMessage(data) {
  const deviceId = data.deviceId;
  
  switch(data.type) {
    case 'connect':
      // New device connected
      addDevice(deviceId, data.color);
      connectionStatus = `${devices.size} phone(s) connected`;
      break;
      
    case 'orientation':
      // Update device orientation data
      updateDeviceOrientation(deviceId, data.tiltX, data.tiltY, data.rotate);
      break;
      
    case 'touch':
      // Handle touch events
      handleDeviceTouch(deviceId, data.x, data.y, data.touches);
      break;
  }
}

function addDevice(deviceId, colorHue) {
  // Store device info
  devices.set(deviceId, {
    color: colorHue,
    tiltX: 0,
    tiltY: 0,
    rotate: 0,
    touchX: 0.5,
    touchY: 0.5,
    touching: false,
    lastSeen: millis()
  });
  
  // Create particle system for this device
  particles.set(deviceId, createParticleSystem(colorHue));
  
  console.log(`Device added: ${deviceId} with color ${colorHue}°`);
}

function createParticleSystem(colorHue) {
  const particleArray = [];
  
  // Create initial particles
  for (let i = 0; i < 50; i++) {
    particleArray.push({
      x: random(width),
      y: random(height),
      vx: random(-2, 2),
      vy: random(-2, 2),
      life: random(100, 255),
      maxLife: random(100, 255),
      size: random(3, 8),
      hue: colorHue + random(-30, 30), // Color variation
      targetX: width / 2,
      targetY: height / 2
    });
  }
  
  return particleArray;
}

function updateDeviceOrientation(deviceId, tiltX, tiltY, rotate) {
  const device = devices.get(deviceId);
  if (device) {
    device.tiltX = tiltX;
    device.tiltY = tiltY;
    device.rotate = rotate;
    device.lastSeen = millis();
    
    // Map tilt to screen position
    // tiltY: -90 to 90 → 0 to width
    // tiltX: -180 to 180 → 0 to height
    device.targetX = map(tiltY, -90, 90, 0, width);
    device.targetY = map(tiltX, -180, 180, 0, height);
  }
}

function handleDeviceTouch(deviceId, touchX, touchY, touchCount) {
  const device = devices.get(deviceId);
  if (device) {
    device.touchX = touchX;
    device.touchY = touchY;
    device.touching = touchCount > 0;
    device.lastSeen = millis();
    
    // Add particles on touch
    if (touchCount > 0) {
      addTouchParticles(deviceId, touchX * width, touchY * height);
    }
  }
}

function addTouchParticles(deviceId, x, y) {
  const deviceParticles = particles.get(deviceId);
  const device = devices.get(deviceId);
  
  if (deviceParticles && device) {
    // Add burst of particles at touch location
    for (let i = 0; i < 10; i++) {
      deviceParticles.push({
        x: x + random(-20, 20),
        y: y + random(-20, 20),
        vx: random(-5, 5),
        vy: random(-5, 5),
        life: 255,
        maxLife: 255,
        size: random(2, 6),
        hue: device.color + random(-20, 20),
        targetX: x,
        targetY: y
      });
    }
  }
}

function updateParticles() {
  particles.forEach((particleArray, deviceId) => {
    const device = devices.get(deviceId);
    if (!device) return;
    
    // Calculate forces from device orientation
    const gravityX = map(device.tiltY, -90, 90, -0.5, 0.5);
    const gravityY = map(device.tiltX, -180, 180, -0.5, 0.5);
    const rotationForce = map(device.rotate, 0, 360, -0.1, 0.1);
    
    // Update each particle
    for (let i = particleArray.length - 1; i >= 0; i--) {
      const p = particleArray[i];
      
      // Apply gravity from phone tilt
      p.vx += gravityX;
      p.vy += gravityY;
      
      // Add rotation influence
      const centerX = device.targetX || width / 2;
      const centerY = device.targetY || height / 2;
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      p.vx += dy * rotationForce * 0.01;
      p.vy -= dx * rotationForce * 0.01;
      
      // Slight attraction to target position
      const attractionStrength = device.touching ? 0.02 : 0.005;
      p.vx += (device.targetX - p.x) * attractionStrength;
      p.vy += (device.targetY - p.y) * attractionStrength;
      
      // Update position
      p.x += p.vx;
      p.y += p.vy;
      
      // Add drag
      p.vx *= 0.98;
      p.vy *= 0.98;
      
      // Wrap around screen
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;
      
      // Age particle
      p.life -= 1;
      
      // Remove dead particles
      if (p.life <= 0) {
        particleArray.splice(i, 1);
      }
    }
    
    // Maintain particle count
    while (particleArray.length < 30) {
      particleArray.push({
        x: device.targetX + random(-100, 100),
        y: device.targetY + random(-100, 100),
        vx: random(-1, 1),
        vy: random(-1, 1),
        life: random(100, 200),
        maxLife: random(100, 200),
        size: random(3, 7),
        hue: device.color + random(-30, 30),
        targetX: device.targetX,
        targetY: device.targetY
      });
    }
  });
}

function drawParticles() {
  particles.forEach((particleArray, deviceId) => {
    const device = devices.get(deviceId);
    if (!device) return;
    
    particleArray.forEach(p => {
      const alpha = map(p.life, 0, p.maxLife, 0, 80);
      
      fill(p.hue % 360, 70, 90, alpha);
      noStroke();
      
      push();
      translate(p.x, p.y);
      rotate(device.rotate * 0.01); // Subtle rotation from phone
      ellipse(0, 0, p.size);
      pop();
    });
  });
}

function drawDeviceInfo() {
  // Draw device target positions
  devices.forEach((device, deviceId) => {
    if (millis() - device.lastSeen > 5000) return; // Skip old devices
    
    stroke(device.color, 100, 100);
    strokeWeight(2);
    noFill();
    
    // Draw target circle
    circle(device.targetX, device.targetY, 50);
    
    // Draw device ID
    fill(device.color, 80, 100);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(12);
    text(deviceId.split('-')[1], device.targetX, device.targetY);
    
    // Show touch indicator
    if (device.touching) {
      stroke(device.color, 100, 100);
      strokeWeight(4);
      noFill();
      circle(device.targetX, device.targetY, 80);
    }
  });
}


function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  if (key === 'c' || key === 'C') {
    // Clear all particles
    particles.forEach(particleArray => {
      particleArray.length = 0;
    });
  }
  
  if (key === 'r' || key === 'R') {
    // Reconnect to server
    if (ws) {
      ws.close();
    }
    connectToServer();
  }
}


function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  
  // Connect to Railway WebSocket server
  connectToServer();
  
  // Create initial visual feedback
  textAlign(CENTER, CENTER);
  textSize(24);
}


function draw() {
  background(220, 20, 5); // Dark background
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Update and draw particles
    updateParticles();
    drawParticles();
    drawDeviceInfo();
    
    // Show connection info
    fill(0, 0, 100, 60);
    noStroke();
    textAlign(LEFT, TOP);
    textSize(16);
    text(connectionStatus, 20, 20);
    
    // Show instructions
    textAlign(LEFT, BOTTOM);
    textSize(14);
    text("Tilt phones to move particle clouds • Touch to add particles", 20, height - 20);
    
  } else {
    // Connection status screen
    fill(0, 0, 100);
    noStroke();
    text(connectionStatus, width/2, height/2);
    text("Make sure phones are connected to:", width/2, height/2 + 40);
    text("hello-world-production-bbc3.up.railway.app", width/2, height/2 + 60);
  }
}
