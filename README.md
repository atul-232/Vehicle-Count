# Dragon Eye - AI Object Detection and Counting

Dragon Eye is a web dashboard and computer vision application that tracks, classifies, and counts moving objects in video streams. It uses classical computer vision algorithms (OpenCV) rather than deep learning models, making it fast and lightweight.

The application has been rebranded to Dragon Eye and features a custom dragon logo and themed interface. It classifies objects into six categories: Cars, Trucks, Buses, Motorcycles, Autos (Rickshaws), and Pedestrians.

---

## Features

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

## How to Run the Application

### 1. Prerequisites
Ensure you have Python 3.9 or higher installed.

### 2. Setup and Installation
Create a virtual environment and install the required dependencies:

```bash
# Clone the repository
git clone https://github.com/atul-232/Vehicle-Count.git
cd Vehicle-Count

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Start the Server
Run the launcher script to start the backend server and open the web dashboard:

```bash
python run.py
```

The application will open automatically in your browser at http://localhost:8000.

---

## Online Deployment

You can deploy this application online using Render:

1. Sign up for a free account at https://render.com.
2. Click New -> Web Service.
3. Connect your GitHub repository.
4. Render will automatically detect the render.yaml configuration file and configure the build settings.
5. Once deployment completes, Render will provide you with a public URL to access your dashboard online.

---

## Algorithm Details

1. **Region of Interest (ROI)**: Restricts analysis to the bottom 60% of the frame to filter out false movements in the background (like trees or clouds).
2. **Background Subtraction**: Uses a K-Nearest Neighbors (KNN) subtractor to isolate moving objects from the background.
3. **Morphological Operations**: Closes gaps inside contours and opens them to remove small noise blobs.
4. **Centroid Tracking**: Matches objects across frames using Euclidean distance between their centers.
5. **Counting Line**: Increments the object counter when a tracked centroid moves upward across the horizontal crossing line.
6. **Smart Classification**: Uses contour area and aspect ratios to distinguish between cars, trucks, buses, motorcycles, autos, and pedestrians.