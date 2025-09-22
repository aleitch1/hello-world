
function draw() {
  // Dark background
  background(0, 0, 10);
  
  if (devices.size > 0) {
    // Draw each device as a colored circle
    devices.forEach((device, deviceId) => {
      // Check if device is still active
      if (millis() - device.lastSeen > 10000) {
        console.log(`⏰ Removing inactive device: ${deviceId}`);
        devices.delete(deviceId);
        return;
      }
      
      // Draw the lightstick
      push();
      translate(device.x, device.y);
      
      // Glow effect
      fill(device.color, 80, 100, 30);
      noStroke();
      circle(0, 0, device.size * 2);
      
      // Main circle
      fill(device.color, 90, 100, 90);
      circle(0, 0, device.size);
      
      // Device ID
      fill(0, 0, 100);
      textAlign(CENTER, CENTER);
      textSize(12);
      text(deviceId.split('-')[1] || deviceId.slice(-3), 0, 0);
      
      pop();
    });
    
    // Status
    fill(0, 0, 100, 80);
    textAlign(LEFT, TOP);
    textSize(16);
    text(status, 20, 20);
    
    // Instructions
    textAlign(LEFT, BOTTOM);
    textSize(14);
    text("Tilt phones to move • Touch to make bigger", 20, height - 20);
    
  } else {
    // Waiting screen
    fill(0, 0, 100);
    textAlign(CENTER, CENTER);
    textSize(24);
    text(status, width/2, height/2);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      textSize(16);
      text("Connect phones to:", width/2, height/2 + 40);
      text("hello-world-production-bbc3.up.railway.app", width/2, height/2 + 60);
    }
  }
}
