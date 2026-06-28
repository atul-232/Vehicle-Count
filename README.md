# Dragon Eye - AI Object Detection and Counting

Live Deployed Website: https://dragon-eye-f23b.onrender.com

---

## Project Overview

Dragon Eye is a web-based computer vision application designed to detect, track, classify, and count moving objects in video streams. The application uses classical image processing algorithms rather than resource-heavy deep learning models, making it lightweight and highly performant. 

The system isolates moving objects, projects bounding boxes around them, draws their path history, and counts them as they cross a specified entry line. It classifies objects into six categories: Cars, Trucks, Buses, Motorcycles, Autos (Rickshaws), and Pedestrians.

---

## Key Features

* **Welcome Screen**: A diagnostics loader screen that plays for 3 seconds when the application starts.
* **Unified Control Console**: Located on the left panel, grouping together the Play, Pause, Stop, and Speed controls.
* **Timeline Seeking**: A progress range slider in the Control Console that lets you scrub and seek to any part of the video, even when paused.
* **Rewind Button**: A button that instantly rewinds the video stream by 5 seconds.
* **6-Class Classification**: Dimension-based classification parameters to accurately separate Cars, Trucks, Buses, Motorcycles, Autos, and Pedestrians.
* **Triple Viewport**: View the annotated RGB stream, the foreground computer vision mask, or a split screen of both.
* **Telemetry Stats**: Live tracking of the total counted objects, active objects in frame, flow rate (objects per minute), and processing FPS.
* **Real-time Charts**: A doughnut chart displaying the count of each object type, plus flow rate and active object charts over time.
* **Log Exporters**: Buttons to export tracking events to a CSV file or download the annotated video as an MP4 file.

---

## How to Install and Run Locally

If the live website link above is inactive or you want to run the project on your local machine, follow these detailed steps to set up, compile, and execute the application:

### 1. Prerequisites
Ensure you have the following software installed on your machine:
* Python (version 3.9 or higher)
* Git (to clone the repository)
* Web browser (Chrome, Firefox, Safari, or Edge)

### 2. Clone the Repository
Open your terminal (macOS/Linux) or Command Prompt/PowerShell (Windows) and clone the project files:
```bash
git clone https://github.com/atul-232/Vehicle-Count.git
cd Vehicle-Count
```

### 3. Set Up a Virtual Environment
A virtual environment isolates the project dependencies from your global Python installation.

On macOS and Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

On Windows:
```bash
python -m venv venv
venv\Scripts\activate
```

### 4. Install Dependencies
Install all the required Python libraries listed in the requirements file:
```bash
pip install -r requirements.txt
```
This command installs FastAPI for the web server, OpenCV-headless for the computer vision engine, Numpy for calculations, and other utility packages.

### 5. Launch the Application
Start the server and browser launcher script:
```bash
python run.py
```
This script will start the FastAPI backend server on http://localhost:8000 and automatically open the web dashboard in your default browser. If it does not open automatically, open your browser and navigate to http://localhost:8000.

---

## Project Structure

```text
Vehicle-Count/
├── backend/
│   ├── tracker.py        # Centroid tracker with position history tracking
│   ├── processor.py      # Video frame processor and object classification
│   └── server.py         # FastAPI Web server and WebSocket controller
├── frontend/
│   ├── index.html        # Dashboard markup
│   ├── style.css         # Layout styling rules
│   ├── app.js            # Frontend telemetry handler and seek controls
│   └── dragon_logo.jpg   # Dragon emblem logo image
├── run.py                # Dashboard launcher script
├── requirements.txt      # Python dependencies list
└── .gitignore            # Git exclusion rules
```

---

## Technical Methodology

1. **Region of Interest (ROI)**: Restricts analysis to the bottom 60% of the frame to filter out false movements in the background (like trees or clouds).
2. **Background Subtraction**: Uses a K-Nearest Neighbors (KNN) subtractor to isolate moving objects from the background.
3. **Morphological Operations**: Closes gaps inside contours and opens them to remove small noise blobs.
4. **Centroid Tracking**: Matches objects across frames using Euclidean distance between their centers.
5. **Counting Line**: Increments the object counter when a tracked centroid moves upward across the horizontal crossing line.
6. **Smart Classification**: Uses contour area and aspect ratios to distinguish between cars, trucks, buses, motorcycles, autos, and pedestrians.