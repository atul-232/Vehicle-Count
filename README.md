# Dragon Eye // AI Object Detection & Counting

A premium, interactive real-time computer vision dashboard and web application that tracks, classifies, and counts moving objects in video streams. Built using **classical computer vision algorithms** (without heavy deep-learning dependencies) and a modern glassmorphic web dashboard interface.

Rebranded to **DRAGON EYE** with custom fire-dragon portal aesthetics, this application can run live detection on pedestrians, auto-rickshaws, bikes, cars, trucks, and buses.

---

## 🌟 Key Features

* **Dragon Portal Aesthetics**: A premium light-themed glassmorphic layout featuring a circular fire-dragon logo emblem, smooth CSS animations, and a fully responsive grid.
* **Welcome Scanning Loader**: A cinematic welcome boot loader that runs high-tech diagnostic scanning logs for 3 seconds before displaying the dashboard.
* **Unified Playback & Seeker Console**:
  * Shipped directly inside the left **Control Console** for a clean, unified layout.
  * Includes standard Play, Pause, and Stop buttons.
  * Features a **Timeline Progress Seek Slider** allowing real-time scrubbing and seeking through the video (even when paused!).
  * A **Rewind Button** that skips backward in the stream by **5 seconds** instantly.
* **6-Way Smart Classification**:
  * Automatically separates objects into six distinct categories: **Cars**, **Trucks**, **Buses**, **Motorcycles**, **Autos (Rickshaws)**, and **Pedestrians**.
  * Highly calibrated dimension, area, and aspect ratio profiles prevent classification errors (e.g. walking men counted as Cars, or Autos categorized as Trucks).
  * Automatically handles partial contours (like walking legs) using a small-area fallback filter.
* **Three-Viewport Visualization**:
  * **Annotated Feed**: High-framerate canvas displaying detected object bounding boxes, category labels, path history trails, crossing lines, and tracking IDs.
  * **CV Foreground Mask**: Live visualization of the background subtraction mask showing how the CV algorithm isolates moving blobs.
  * **Split View**: Side-by-side feed showing the annotated RGB stream and the CV mask simultaneously.
* **Telemetry Statistics Panel**:
  * **Object Counter**: Cumulative odometer tracking total counted objects.
  * **Active Objects**: Number of targets currently in the scene.
  * **Flow Rate**: Objects crossed per minute.
  * **Processing FPS**: Processing speed of the computer vision engine.
* **6-Way Doughnut Type Chart**: A color-coded segment chart updating dynamically in real time for Cars (Sky Blue), Trucks (Violet), Buses (Orange), Bikes (Green), Autos (Gold), and Pedestrians (Pink).
* **Cyberpunk Activity Log**: Terminal showing scrolling detection events with cross speeds and object descriptors.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphism), JavaScript (WebSockets, HTML5 Canvas, Chart.js, Lucide Icons)
* **Backend**: FastAPI, Uvicorn, Python WebSockets
* **Computer Vision**: OpenCV (KNN Background Subtractor, Morphological Filtering, Contour Detection, Centroid Tracker)

---

## 📁 Project Structure

```text
Vehicle-Count/
├── backend/
│   ├── tracker.py        # Refactored classical CentroidTracker with path history
│   ├── processor.py      # Video frame processor & 6-class annotation classifier
│   └── server.py         # FastAPI Web server with seek-control and no-cache middleware
├── frontend/
│   ├── index.html        # Glassmorphic dashboard UI
│   ├── style.css         # Premium stylesheet with dragon logo styles
│   ├── app.js            # WebSocket client, timeline seekbar handlers, and UI logic
│   └── dragon_logo.jpg   # Custom circular fire-dragon emblem asset
├── run.py                # Dashboard launcher script
├── requirements.txt      # Python dependencies list
└── .gitignore            # Git exclusion settings
```

---

## 🚀 How to Run the Dashboard

### 1. Prerequisite Check
Ensure you have Python 3.9+ installed on your computer.

### 2. Set Up Virtual Environment & Dependencies
Create a virtual environment and install the required libraries:
```bash
# Clone the repository (if not already local)
git clone https://github.com/atul-232/Vehicle-Count.git
cd Vehicle-Count

# Create virtual environment
python3 -m venv venv

# Activate and install dependencies
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
pip install -r requirements.txt
```

### 3. Launch the Application
Run the launcher script to automatically start the backend and open the web dashboard:
```bash
python run.py
```
A browser window will open automatically at **`http://localhost:8000`**.

---

## 🧠 Methodology & Algorithm

The core solution relies on **classical computer vision techniques only**, complying with strict hackathon rules that prohibit deep learning models:

1. **Region of Interest (ROI)**: Focuses processing only on the bottom 60% of the frame (the road roadbed). This filters out trees, clouds, buildings, and sky, reducing false detections.
2. **Background Subtraction**: Uses `cv2.createBackgroundSubtractorKNN` to detect motion. The algorithm handles gradual illumination changes and filters shadows.
3. **Morphological Filtering**: Performs **Closing** (merging fragmented blobs of the same vehicle) and **Opening** (eliminating salt-and-pepper noise) with custom kernels.
4. **Contour Extraction**: Identifies external contours and filters out noise blobs.
5. **Centroid Tracking**: Matches centroids across frames using Euclidean distance. Vehicles are kept in state even during brief occlusions (`max_disappeared=25`).
6. **Smart Classification**:
   * **Pedestrians**: Vertical aspect ratio (`ar < 0.58`, `bw < 60`, `area < 6500`) or small contours (`area < 2800`).
   * **Bikes**: Narrow aspect ratio (`ar < 0.85`, `bw < 75`, `area < 9500`).
   * **Autos**: Boxy shapes (`0.62 <= ar <= 1.25`, `55 <= bw <= 135`, `3500 <= area < 19000`).
   * **Large (Buses/Trucks)**: Large areas (`area > 24000`, `bw > 140`, `bh > 95`).
   * **Cars**: Standard default classification.