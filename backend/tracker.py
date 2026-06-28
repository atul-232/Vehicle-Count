import numpy as np

class CentroidTracker:
    def __init__(self, max_disappeared=25, max_history_len=20):
        self.next_id = 0
        self.objects = {}       # id -> centroid (x, y)
        self.disappeared = {}   # id -> frames disappeared
        self.history = {}       # id -> list of centroids [(x, y), ...]
        self.max_disappeared = max_disappeared
        self.max_history_len = max_history_len

    def register(self, centroid):
        self.objects[self.next_id] = centroid
        self.disappeared[self.next_id] = 0
        self.history[self.next_id] = [tuple(centroid)]
        self.next_id += 1

    def deregister(self, object_id):
        if object_id in self.objects:
            del self.objects[object_id]
        if object_id in self.disappeared:
            del self.disappeared[object_id]
        if object_id in self.history:
            del self.history[object_id]

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

            # Compute Euclidean distance between all pair of centroids
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
                
                # Update history
                self.history[object_id].append(tuple(input_centroids[col]))
                if len(self.history[object_id]) > self.max_history_len:
                    self.history[object_id].pop(0)

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
