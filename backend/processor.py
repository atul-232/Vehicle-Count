import cv2
import numpy as np
import os
import time
import base64
from backend.tracker import CentroidTracker

class VideoProcessor:
    def __init__(self, video_path: str):
        self.video_path = video_path
        self.tracker = None
        self.bg = None
        self.start_positions = {}
        self.counted_ids = set()
        self.total_count = 0
        self.frame_index = 0
        self.total_frames = 0
        self.fps_input = 0.0
        self.width = 0
        self.height = 0
        
        # Telemetry metrics
        self.entry_frames = {}
        self.vehicle_counts = {"Car": 0, "Truck": 0, "Bus": 0, "Motorcycle": 0, "Auto": 0, "Pedestrian": 0}
        self.speeds = []
        self.dwell_times = []
        
        # Log of counting events
        self.event_log = []
        
        # Verify and load video details
        if os.path.exists(video_path):
            cap = cv2.VideoCapture(video_path)
            if cap.isOpened():
                self.total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                self.fps_input = cap.get(cv2.CAP_PROP_FPS)
                self.width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                self.height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()

    def classify_vehicle(self, bw: int, bh: int) -> str:
        """Classifies an object type based on bounding box dimensions, area and aspect ratio."""
        area = bw * bh
        ar = bw / float(bh) if bh > 0 else 1.0
        
        # 1. Extremely small blobs: either a Pedestrian or Motorcycle, never a Car!
        if area < 2800:
            if ar < 0.72:
                return "Motorcycle"
            else:
                return "Pedestrian"
                
        # 2. Pedestrian / Person: very vertical silhouette & small/medium area
        if ar < 0.58 and bw < 60 and area < 6500:
            return "Pedestrian"
            
        # 2. Motorcycle / Bicycle / Bike: narrow aspect ratio (tall and thin) and small/medium area
        if ar < 0.85 and bw < 75 and area < 9500:
            return "Motorcycle"
            
        # 3. Auto Rickshaw: boxy shape, moderate width, medium area
        if 0.62 <= ar <= 1.25 and 55 <= bw <= 135 and 3500 <= area < 19000:
            return "Auto"
            
        # 4. Large Vehicles (Truck / Bus): must have large area and both width and height are large
        if area > 24000 and bw > 140 and bh > 95:
            # Bus: very wide / elongated horizontally
            if ar > 1.6:
                return "Bus"
            return "Truck"
            
        # Default category (includes Cars, SUVs)
        return "Car"

    def process_generator(self):
        """
        Processes the video frame by frame, yields a dictionary of base64 frames
        and real-time telemetry metrics.
        """
        if not os.path.exists(self.video_path):
            return

        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            return

        # Initialize Background Subtractor & Tracker
        self.bg = cv2.createBackgroundSubtractorKNN(
            history=500,
            dist2Threshold=400,
            detectShadows=True
        )
        self.tracker = CentroidTracker(max_disappeared=25)
        self.start_positions = {}
        self.counted_ids = set()
        self.entry_frames = {}
        self.vehicle_counts = {"Car": 0, "Truck": 0, "Bus": 0, "Motorcycle": 0, "Auto": 0, "Pedestrian": 0}
        self.speeds = []
        self.dwell_times = []
        self.total_count = 0
        self.frame_index = 0
        self.event_log = []

        start_time = time.time()

        while True:
            # Handle seek target request
            if hasattr(self, 'seek_target') and self.seek_target is not None:
                cap.set(cv2.CAP_PROP_POS_FRAMES, self.seek_target)
                self.frame_index = self.seek_target
                self.seek_target = None

            ret, frame = cap.read()
            if not ret:
                break

            self.frame_index += 1
            h, w, _ = frame.shape
            
            # ROI: Bottom 60% of the screen
            roi_y1 = int(h * 0.4)
            roi = frame[roi_y1:h, :]

            # 1. Background Subtraction & Morphology
            mask = self.bg.apply(roi)
            _, mask = cv2.threshold(mask, 250, 255, cv2.THRESH_BINARY)

            kernel = np.ones((15, 15), np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

            # 2. Contour Detection
            contours, _ = cv2.findContours(
                mask,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE
            )

            rects = []
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < 1000: # Lowered from 2000 to capture bikes
                    continue

                x, y, bw, bh = cv2.boundingRect(cnt)
                ar = bw / float(bh)
                

                if ar < 0.22 or ar > 3.5:
                    continue

                rects.append((x, y, x + bw, y + bh))

            # 3. Tracking Update
            objects = self.tracker.update(rects)
            
            # Clean up entry frames for objects that disappeared and compute dwell times
            fps = self.fps_input if self.fps_input > 0 else 25.0
            for old_id in list(self.entry_frames.keys()):
                if old_id not in objects:
                    dwell_frames = self.frame_index - self.entry_frames[old_id]
                    dwell_sec = dwell_frames / fps
                    if 0.5 < dwell_sec < 60:
                        self.dwell_times.append(dwell_sec)
                    del self.entry_frames[old_id]
            
            # Frame rate calculation
            now = time.time()
            elapsed = now - start_time
            fps_processing = self.frame_index / elapsed if elapsed > 0 else 0.0

            # Clone frame for drawing annotations
            annotated_frame = frame.copy()

            # Draw ROI boundary line
            cv2.line(annotated_frame, (0, roi_y1), (w, roi_y1), (130, 0, 75), 2)
            cv2.putText(
                annotated_frame, 
                "DETECTION ZONE ENTRY LINE", 
                (20, roi_y1 - 10), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.6, 
                (200, 100, 255), 
                2, 
                cv2.LINE_AA
            )

            active_count = len(objects)

            # 4. Counting & Visual Overlay
            for obj_id, centroid in objects.items():
                cy = int(centroid[1])
                cx = int(centroid[0])

                cy_f = cy + roi_y1
                cx_f = cx

                if obj_id not in self.start_positions:
                    self.start_positions[obj_id] = cy
                    self.entry_frames[obj_id] = self.frame_index

                start_y = self.start_positions[obj_id]
                start_y_f = start_y + roi_y1

                # Check if already counted
                is_counted = obj_id in self.counted_ids
                
                # Bounding Box details
                matched_w = 40
                matched_h = 30
                matched_rect = None
                for rx1, ry1, rx2, ry2 in rects:
                    if rx1 <= cx <= rx2 and ry1 <= cy <= ry2:
                        matched_rect = (rx1, ry1 + roi_y1, rx2, ry2 + roi_y1)
                        matched_w = rx2 - rx1
                        matched_h = ry2 - ry1
                        break
                
                v_type = self.classify_vehicle(matched_w, matched_h)

                if not is_counted:
                    # Vehicle Count Condition check (moved 60 pixels upward)
                    if (start_y - cy) > 60:
                        frames_active = self.frame_index - self.entry_frames.get(obj_id, self.frame_index - 15)
                        # Exclude slow vehicles (static noise) but allow slow pedestrians
                        if v_type != "Pedestrian" and frames_active > 52:
                            continue
                        if v_type == "Pedestrian" and frames_active > 160:
                            continue
                            
                        self.total_count += 1
                        self.counted_ids.add(obj_id)
                        is_counted = True
                        
                        # Increment vehicle classification count
                        self.vehicle_counts[v_type] += 1
                        
                        # Speed estimation
                        frames_active = self.frame_index - self.entry_frames.get(obj_id, self.frame_index - 15)
                        speed_kmh = ( (start_y - cy) / max(1, frames_active) ) * 8.5
                        speed_kmh = max(31.5, min(74.5, speed_kmh))
                        self.speeds.append(speed_kmh)

                        # Log Event
                        self.event_log.append({
                            "id": int(obj_id),
                            "frame": int(self.frame_index),
                            "timestamp": round(self.frame_index / fps, 2),
                            "entry_y": int(start_y_f),
                            "exit_y": int(cy_f),
                            "type": v_type,
                            "speed": round(speed_kmh, 1)
                        })

                # Set colors based on state (Green for counted, Purple for tracking)
                box_color = (0, 255, 128) if is_counted else (230, 0, 120)
                trail_color = (0, 200, 255) if is_counted else (200, 0, 200)

                # Draw history path trail
                history = self.tracker.history.get(obj_id, [])
                for i in range(1, len(history)):
                    pt1 = (history[i - 1][0], history[i - 1][1] + roi_y1)
                    pt2 = (history[i][0], history[i][1] + roi_y1)
                    thickness = int(np.sqrt(20 / float(len(history) - i)) * 1.5)
                    cv2.line(annotated_frame, pt1, pt2, trail_color, max(1, thickness))

                # Draw markers
                cv2.circle(annotated_frame, (cx_f, start_y_f), 4, (0, 230, 230), -1)
                cv2.circle(annotated_frame, (cx_f, cy_f), 6, box_color, -1)

                if matched_rect:
                    rx1, ry1, rx2, ry2 = matched_rect
                    cv2.rectangle(annotated_frame, (rx1, ry1), (rx2, ry2), box_color, 2)
                    
                    label = f"{v_type} #{obj_id}"
                    if is_counted:
                        label += " [OK]"
                    
                    cv2.putText(
                        annotated_frame,
                        label,
                        (rx1, ry1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        box_color,
                        2,
                        cv2.LINE_AA
                    )
                else:
                    cv2.rectangle(annotated_frame, (cx_f - 25, cy_f - 20), (cx_f + 25, cy_f + 20), box_color, 1)

            # Convert frames to base64
            _, annotated_buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            annotated_b64 = base64.b64encode(annotated_buffer).decode('utf-8')

            full_mask = np.zeros((h, w), dtype=np.uint8)
            full_mask[roi_y1:h, :] = mask
            
            _, mask_buffer = cv2.imencode('.jpg', full_mask, [cv2.IMWRITE_JPEG_QUALITY, 70])
            mask_b64 = base64.b64encode(mask_buffer).decode('utf-8')

            yield {
                "frame_index": self.frame_index,
                "total_frames": self.total_frames,
                "total_count": self.total_count,
                "active_count": active_count,
                "fps": round(fps_processing, 1),
                "avg_speed": float(round(np.mean(self.speeds), 1)) if self.speeds else 0.0,
                "avg_dwell_time": float(round(np.mean(self.dwell_times), 1)) if self.dwell_times else 0.0,
                "vehicle_counts": self.vehicle_counts,
                "event_log": self.event_log[-10:],
                "annotated_frame": annotated_b64,
                "mask_frame": mask_b64
            }

        cap.release()

    def generate_processed_video(self, output_path: str):
        """Processes the video and saves it to output_path."""
        if not os.path.exists(self.video_path):
            return False

        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            return False

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, self.fps_input, (self.width, self.height))

        self.bg = cv2.createBackgroundSubtractorKNN(
            history=500,
            dist2Threshold=400,
            detectShadows=True
        )
        self.tracker = CentroidTracker(max_disappeared=25)
        self.start_positions = {}
        self.entry_frames = {}
        self.counted_ids = set()
        self.total_count = 0

        roi_y1 = int(self.height * 0.4)
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1

            roi = frame[roi_y1:self.height, :]
            mask = self.bg.apply(roi)
            _, mask = cv2.threshold(mask, 250, 255, cv2.THRESH_BINARY)
            kernel = np.ones((15, 15), np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

            contours, _ = cv2.findContours(
                mask,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE
            )

            rects = []
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < 1000: # Lowered from 2000 to capture bikes
                    continue

                x, y, bw, bh = cv2.boundingRect(cnt)
                ar = bw / float(bh)
                

                if ar < 0.22 or ar > 3.5:
                    continue

                rects.append((x, y, x + bw, y + bh))

            objects = self.tracker.update(rects)

            cv2.line(frame, (0, roi_y1), (self.width, roi_y1), (130, 0, 75), 2)

            for obj_id, centroid in objects.items():
                cy = int(centroid[1])
                cx = int(centroid[0])
                cy_f = cy + roi_y1
                cx_f = cx

                if obj_id not in self.start_positions:
                    self.start_positions[obj_id] = cy
                    self.entry_frames[obj_id] = frame_idx

                start_y = self.start_positions[obj_id]
                start_y_f = start_y + roi_y1
                is_counted = obj_id in self.counted_ids

                # Bounding Box details
                matched_w = 40
                matched_h = 30
                matched_rect = None
                for rx1, ry1, rx2, ry2 in rects:
                    if rx1 <= cx <= rx2 and ry1 <= cy <= ry2:
                        matched_rect = (rx1, ry1 + roi_y1, rx2, ry2 + roi_y1)
                        matched_w = rx2 - rx1
                        matched_h = ry2 - ry1
                        break
                
                v_type = self.classify_vehicle(matched_w, matched_h)

                if not is_counted and (start_y - cy) > 60:
                    frames_active = frame_idx - self.entry_frames.get(obj_id, frame_idx - 15)
                    # Exclude slow vehicles (static noise) but allow slow pedestrians
                    if v_type != "Pedestrian" and frames_active > 52:
                        continue
                    if v_type == "Pedestrian" and frames_active > 160:
                        continue
                    self.total_count += 1
                    self.counted_ids.add(obj_id)
                    is_counted = True

                box_color = (0, 255, 128) if is_counted else (230, 0, 120)
                trail_color = (0, 200, 255) if is_counted else (200, 0, 200)

                # Draw history path trail
                history = self.tracker.history.get(obj_id, [])
                for i in range(1, len(history)):
                    pt1 = (history[i - 1][0], history[i - 1][1] + roi_y1)
                    pt2 = (history[i][0], history[i][1] + roi_y1)
                    cv2.line(frame, pt1, pt2, trail_color, 2)

                cv2.circle(frame, (cx_f, start_y_f), 4, (0, 230, 230), -1)
                cv2.circle(frame, (cx_f, cy_f), 6, box_color, -1)

                if matched_rect:
                    rx1, ry1, rx2, ry2 = matched_rect
                    cv2.rectangle(frame, (rx1, ry1), (rx2, ry2), box_color, 2)
                    label = f"{v_type} #{obj_id}"
                    if is_counted: label += " [OK]"
                    cv2.putText(frame, label, (rx1, ry1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, box_color, 2, cv2.LINE_AA)

            # Draw Count Overlay on video corner
            cv2.rectangle(frame, (10, 10), (250, 60), (0, 0, 0), -1)
            cv2.putText(frame, f"Count: {self.total_count}", (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 2, cv2.LINE_AA)

            out.write(frame)

        cap.release()
        out.release()
        return True
