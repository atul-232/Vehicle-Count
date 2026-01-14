import cv2
from main import Solution

def run_local_test():
    # 1. Initialize your solution 
    sol = Solution()
    
    # 2. Define the path to your video fil
    # Replace 'your_video.mp4' with the actual name of your file
    video_path = "video_03.mp4" 
    
    print(f"Starting analysis for: {video_path}")
    
    # 3. Call the forward method to get the count 
    try:
        total_vehicles = sol.forward(video_path)
        
        print("-" * 30)
        print(f"RESULT: {total_vehicles} vehicles detected.")
        print("-" * 30)
        
    except Exception as e:
        print(f"Error during execution: {e}")

if __name__ == "__main__":
    run_local_test()