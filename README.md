# Vehicle Count Challenge – Vehant Hackathon (Jan 2026)

## Problem Overview

The objective of this challenge is to estimate the **total number of vehicles** appearing in a traffic video captured from a **static camera**, where vehicles are **moving away from the camera**.

This solution strictly follows the hackathon constraints by using **classical computer vision techniques only**, without relying on any deep learning or learning-based object detection models.

---

## Key Constraints Followed

- No deep learning models (YOLO, SSD, Faster R-CNN, etc.)
- No pretrained or trained models
- No hardcoded video paths or outputs
- Classical image processing techniques only
- Reproducible and self-contained solution
- Works on unseen / hidden test videos

---

## Approach Summary

The solution follows a **motion-based vehicle counting pipeline** consisting of:

- Region of Interest (ROI) Selection
- Background Subtraction
- Morphological Processing
- Contour Detection
- Centroid-Based Object Tracking
- Direction-Aware Vehicle Counting

Each vehicle is counted **exactly once** when it satisfies a well-defined movement condition.

---

## Detailed Methodology

### 1. Region of Interest (ROI)

- Only the **bottom 60% of the frame** is processed
- Corresponds to the road region
- Eliminates irrelevant background such as sky and buildings
- Improves accuracy and reduces noise

---

### 2. Background Subtraction

- Uses **KNN Background Subtractor**
  (`cv2.createBackgroundSubtractorKNN`)
- Suitable for:
  - Static cameras
  - Gradual illumination changes
  - Long video sequences
- Shadow pixels are removed using thresholding to reduce false detections

---

### 3. Morphological Processing

- **Closing** operation merges fragmented vehicle regions
- **Opening** operation removes small noise blobs
- A larger kernel ensures each vehicle appears as a single connected component
- Improves contour stability

---

### 4. Contour Detection

- External contours are extracted from the foreground mask
- Small contours (area < 2000 pixels) are ignored to filter:
  - Pedestrians
  - Noise
  - Background artifacts
- Bounding boxes are created for valid vehicle candidates

---

### 5. Centroid-Based Tracking

- A custom **CentroidTracker** assigns a unique ID to each detected vehicle
- Tracks objects across frames using centroid proximity
- Handles temporary occlusions with a `max_disappeared` threshold
- Prevents multiple counting of the same vehicle

---

### 6. Direction-Aware Vehicle Counting

A vehicle is counted **only when all conditions are satisfied**:

- The vehicle has not been counted before
- It is moving **away from the camera**
- It has moved at least **60 pixels upward** in ROI coordinates

This logic prevents:
- Double counting
- Counting stationary objects
- Counting noise blobs

---

### 7. Output

The `forward(video_path)` method returns:

int # total number of vehicles

- No printing or logging inside the solution
- Output handling is done externally by the caller

---

## Project Structure

Vehicle_Count/
├── README.md
├── main.py # Solution class and forward() method
├── requirements.txt # Python dependencies
├── test.py # Sample runner script
└── video_03.mp4 # Sample input video

---

## How to Run

### 1. Install Dependencies

```bash
pip install -r requirements.txt
2. Run Using test.py (Recommended)
python test.py
Ensure video_03.mp4 is present in the same directory or update the video path inside test.py.
3. Manual Usage
You may also run the solution directly from any Python script:
from main import Solution

solution = Solution()
count = solution.forward("video_03.mp4")
print("Total Vehicles Counted:", count)
Dependencies
Listed in requirements.txt:
Python 3.x
OpenCV
NumPy
No internet access is required at runtime.
Assumptions
Camera is static
Vehicles move away from the camera
Video input is continuous without abrupt camera movement
Minor lighting changes are handled by background modeling
Conclusion
This solution provides a robust, rule-compliant, and reproducible approach to vehicle counting using classical computer vision techniques.
It is designed to generalize effectively across different traffic videos and hidden evaluation datasets.