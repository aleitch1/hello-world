# Phone Controller Setup Guide

## Quick Start (For Demo Day)

### 1. Install Dependencies (one time)
```bash
npm install ws osc-js
```

### 2. Find Your Computer's IP Address
- **Mac**: System Preferences → Network → Your IP (like 192.168.1.23)
- **Windows**: `ipconfig` in terminal → IPv4 Address
- **Linux**: `ip addr show` → inet address

### 3. Start the Bridge Server
```bash
node bridge.js
```
You'll see:
```
WebSocket to OSC Bridge Started
Phones connect to: ws://<your-ip>:8080
Sending OSC to: 127.0.0.1:7000
```

### 4. Deploy HTML to GitHub Pages
1. Add `phone-controller.html` to your GitHub repo
2. Push to GitHub
3. Enable GitHub Pages in Settings
4. Your URL: `https://yourusername.github.io/phone-controller.html`

### 5. Connect Phones
1. Students open the GitHub Pages URL on phones
2. Replace `localhost` with your computer's IP: `ws://192.168.1.23:8080`
3. Click CONNECT
4. Each phone gets a unique color!

## TouchDesigner Setup

### Receiving OSC in TouchDesigner

1. **Create OSC In CHOP**
   - Add → CHOP → OSC In
   - Network Port: `7000`
   - Active: On

2. **View All Messages**
   - OSC In → Select CHOP
   - You'll see channels like:
   ```
   /user-123/tiltX
   /user-123/tiltY
   /user-123/touchX
   /user-123/touchY
   ```

3. **Use Phone Data to Control Visuals**
   ```
   Phone Tilt → OSC In → Math CHOP → Transform TOP
   Phone Touch → OSC In → Speed CHOP → Movie File In
   ```

### Example TD Network

```
[OSC In] → [Select "/*/tiltX"] → [Math (range -1 to 1)] → [Noise TOP transform]
         → [Select "/*/touchX"] → [Speed CHOP] → [Circle TOP position]
```

## OSC Message Reference

### Messages Sent from Phone → TouchDesigner

| OSC Address | Values | Description |
|------------|--------|-------------|
| `/device/connected` | id, hue | New phone connected |
| `/[deviceId]/tiltX` | 0.0-1.0 | Phone tilt forward/back |
| `/[deviceId]/tiltY` | 0.0-1.0 | Phone tilt left/right |
| `/[deviceId]/rotate` | 0.0-1.0 | Phone compass rotation |
| `/[deviceId]/touchX` | 0.0-1.0 | Touch X position |
| `/[deviceId]/touchY` | 0.0-1.0 | Touch Y position |
| `/[deviceId]/touches` | 0-5 | Number of fingers |
| `/devices/count` | integer | Total connected phones |

## Troubleshooting

### "Connection Failed" on Phones
- Check firewall isn't blocking port 8080
- Ensure phones are on same WiFi as computer
- Verify IP address is correct

### No Data in TouchDesigner
- Check OSC In CHOP port is 7000
- Look at Info CHOP connected to OSC In for debug info
- Try sending test message: `node -e "require('osc-js').send('/test', 1)"`

### iOS Permission Issues
- iOS 13+ requires motion permission
- Must use HTTPS for production (GitHub Pages works)
- Users must tap "Allow" when prompted

## Teaching Notes

### Week 5 Demo Script
1. "Everyone open this URL on your phone"
2. "Enter this server address: ws://192.168.1.23:8080"
3. "Notice your unique color - that's your ID"
4. "Tilt your phone - see the projection change"
5. "Touch the screen - you're all controlling different parameters"
6. Show the 200 lines of code
7. "This works, but imagine managing 50 phones..."
8. Open TouchDesigner: "This is why we use tools"

### Conceptual Points to Emphasize
- **It's just messages**: Phone sends numbers, computer receives them
- **Network = Wireless Wire**: Same as Arduino, but over WiFi
- **TouchDesigner = Organization**: Manages complexity we'd otherwise code
- **Professional Reality**: Beyoncé's show can't crash because of a WebSocket error

### Weekly Expansions
- **Week 6**: Add slider/button UI elements
- **Week 7**: Multi-touch gestures
- **Week 8**: Phone microphone → audio reactive
- **Week 9**: Accelerometer for shake detection
- **Week 10**: Multiple phones collaborative control