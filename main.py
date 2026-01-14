import cv2
import numpy as np
import os

# =========================================================
# MODULE 1: CENTROID TRACKER (CLASSICAL CV, NO DL)
# =========================================================
class CentroidTracker:
    def __init__(self, max_disappeared=25):
        self.next_id = 0
        self.objects = {}
        self.disappeared = {}
        self.max_disappeared = max_disappeared

    def register(self, centroid):
        self.objects[self.next_id] = centroid
        self.disappeared[self.next_id] = 0
        self.next_id += 1

    def deregister(self, object_id):
        del self.objects[object_id]
        del self.disappeared[object_id]

    def update(self, rects):
        if len(rects) == 0:
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
            return self.objects

        input_centroids = np.zeros((len(rects), 2), dtype="int")
        for i, (x1, y1, x2, y2) in enumerate(rects):
            input_centroids[i] = (
                int((x1 + x2) / 2),
                int((y1 + y2) / 2)
            )

        if len(self.objects) == 0:
            for i in range(len(input_centroids)):
                self.register(input_centroids[i])
        else:
            object_ids = list(self.objects.keys())
            object_centroids = list(self.objects.values())

            D = np.linalg.norm(
                np.array(object_centroids)[:, None] - input_centroids,
                axis=2
            )

            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]

            used_rows, used_cols = set(), set()

            for row, col in zip(rows, cols):
                if row in used_rows or col in used_cols:
                    continue

                if D[row, col] > 100:  # jump filter
                    continue

                object_id = object_ids[row]
                self.objects[object_id] = input_centroids[col]
                self.disappeared[object_id] = 0
                used_rows.add(row)
                used_cols.add(col)

            for row in set(range(len(object_centroids))) - used_rows:
                object_id = object_ids[row]
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)

            for col in set(range(len(input_centroids))) - used_cols:
                self.register(input_centroids[col])

        return self.objects


# =========================================================
# MODULE 2: MAIN SOLUTION (FINAL, SUBMIT-SAFE)
# =========================================================
class Solution:
    def __init__(self):
        self.bg = None
        self.tracker = None
        self.start_positions = {}

    def forward(self, video_path: str) -> int:
        """
        Args:
            video_path (str): Path to traffic video

        Returns:
            int: Total number of vehicles
        """

        if not os.path.exists(video_path):
            return 0

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return 0

        # --- Initialize ---
        self.bg = cv2.createBackgroundSubtractorKNN(
            history=500,
            dist2Threshold=400,
            detectShadows=True
        )

        self.tracker = CentroidTracker(max_disappeared=25)
        self.start_positions = {}
        counted_ids = set()

        total_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            h, w, _ = frame.shape

            # Focus on road area only (bottom 60%)
            roi_y1 = int(h * 0.4)
            roi = frame[roi_y1:h, :]

            # --- Background Subtraction ---
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
                if cv2.contourArea(cnt) < 2000:
                    continue

                x, y, bw, bh = cv2.boundingRect(cnt)
                ar = bw / float(bh)
                if ar < 0.25 or ar > 3.5:
                    continue

                rects.append((x, y, x + bw, y + bh))

            # --- Tracking ---
            objects = self.tracker.update(rects)

            for obj_id, centroid in objects.items():
                cy = centroid[1]

                if obj_id not in self.start_positions:
                    self.start_positions[obj_id] = cy

                if obj_id not in counted_ids:
                    start_y = self.start_positions[obj_id]

                    # VEHICLE COUNT CONDITION:
                    # Must move AWAY from camera by at least 60 pixels
                    if (start_y - cy) > 60:
                        total_count += 1
                        counted_ids.add(obj_id)

        cap.release()
        return int(total_count)
