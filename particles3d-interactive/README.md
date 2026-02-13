# Particles 3D Interactive

This project is a single-file 3D interactive particle system controlled by:
- **Face Expressions** (Smile/Frown/Open Mouth)
- **Hand Gestures** (Confetti Throw)
- **Mouse Interaction** (Magnetic Sphere)

The entire project is contained in `index.html`. It loads all dependencies (Three.js, MediaPipe) from the internet (CDN).

## 🚀 How to Run (Important!)

You cannot simply double-click the `index.html` file because browsers block webcam access for local files (`file://` protocol). You must serve it via a local HTTP server.

### Option 1: Using Python (Simplest - Mac/Linux/Windows)
If you have Python installed (most Macs do):

1. Open your terminal/command prompt.
2. Navigate to the folder containing `index.html`.
3. Run:
   ```bash
   python3 -m http.server 8000
   ```
4. Open your browser and go to: **http://localhost:8000**

### Option 2: Using Node.js (If installed)
If you have Node.js installed:

1. Install a simple server globally:
   ```bash
   npm install -g http-server
   ```
2. Run it in the folder:
   ```bash
   http-server .
   ```
3. Open the link shown in the terminal.

### Option 3: VS Code "Live Server"
If you use VS Code:
1. Install the "Live Server" extension.
2. Right-click `index.html` -> "Open with Live Server".

## 📦 Exporting
To share this project, just send the `index.html` file (and this README). That's it!
