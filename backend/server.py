import os
import shutil
from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from backend.processor import VideoProcessor

app = FastAPI(title="Vehicle Counting System API")

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMP_DIR = os.path.join(BASE_DIR, "temp")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(FRONTEND_DIR, exist_ok=True)

@app.get("/api/videos")
async def list_videos():
    """Lists available traffic videos in the project directory and uploads folder."""
    videos = []
    
    # 1. Check for files in root directory
    for f in os.listdir(BASE_DIR):
        if f.endswith(('.mp4', '.avi', '.mov', '.mkv')) and not f.startswith('.'):
            path = os.path.join(BASE_DIR, f)
            size = os.path.getsize(path)
            videos.append({
                "name": f,
                "type": "sample",
                "size_mb": round(size / (1024 * 1024), 2),
                "path_key": f
            })
            
    # 2. Check for uploaded files in temp directory
    if os.path.exists(TEMP_DIR):
        for f in os.listdir(TEMP_DIR):
            if f.endswith(('.mp4', '.avi', '.mov', '.mkv')) and not f.startswith('.') and not f.startswith('processed_'):
                path = os.path.join(TEMP_DIR, f)
                size = os.path.getsize(path)
                videos.append({
                    "name": f,
                    "type": "uploaded",
                    "size_mb": round(size / (1024 * 1024), 2),
                    "path_key": f"temp/{f}"
                })
                
    return videos

@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    """Uploads a video to the temporary folder for processing."""
    if not file.filename.endswith(('.mp4', '.avi', '.mov', '.mkv')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a video file.")
    
    # Clean up filename
    safe_filename = "".join([c if c.isalnum() or c in "._-" else "_" for c in file.filename])
    target_path = os.path.join(TEMP_DIR, safe_filename)
    
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        
    return {
        "filename": safe_filename,
        "path_key": f"temp/{safe_filename}",
        "size_mb": round(os.path.getsize(target_path) / (1024 * 1024), 2)
    }

@app.get("/api/download_processed")
async def download_processed(video_key: str):
    """Processes the video end-to-end and returns a downloadable annotated MP4 file."""
    # Resolve the true path of the video
    if video_key.startswith("temp/"):
        video_name = video_key.replace("temp/", "")
        video_path = os.path.join(TEMP_DIR, video_name)
    else:
        video_path = os.path.join(BASE_DIR, video_key)
        video_name = video_key

    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Source video not found.")

    output_filename = f"processed_{os.path.splitext(video_name)[0]}.mp4"
    output_path = os.path.join(TEMP_DIR, output_filename)

    # Process video fully (synchronously for the file write)
    processor = VideoProcessor(video_path)
    success = processor.generate_processed_video(output_path)

    if not success or not os.path.exists(output_path):
        raise HTTPException(status_code=500, detail="Failed to process video.")

    return FileResponse(
        output_path, 
        media_type="video/mp4", 
        filename=output_filename
    )

@app.websocket("/api/stream")
async def websocket_stream(websocket: WebSocket, video_key: str):
    """WebSocket endpoint that streams frames and tracking telemetry."""
    await websocket.accept()
    
    # Resolve the video path
    if video_key.startswith("temp/"):
        video_name = video_key.replace("temp/", "")
        video_path = os.path.join(TEMP_DIR, video_name)
    else:
        video_path = os.path.join(BASE_DIR, video_key)

    if not os.path.exists(video_path):
        await websocket.send_json({"error": "Video file not found"})
        await websocket.close()
        return

    # Initialize video processor
    processor = VideoProcessor(video_path)
    
    # Connection state
    state = {
        "paused": False,
        "stopped": False,
        "speed": 1.0,
        "seek_frame": None
    }

    # Listen for client control messages in the background
    async def receive_messages():
        try:
            while not state["stopped"]:
                data = await websocket.receive_json()
                action = data.get("action")
                if action == "pause":
                    state["paused"] = True
                elif action == "resume":
                    state["paused"] = False
                elif action == "stop":
                    state["stopped"] = True
                elif action == "speed":
                    state["speed"] = float(data.get("value", 1.0))
                elif action == "seek":
                    state["seek_frame"] = int(data.get("value", 0))
        except Exception:
            state["stopped"] = True

    # Start the control listener task
    listener_task = asyncio.create_task(receive_messages())

    try:
        # Loop through frames generated by the processor
        for frame_data in processor.process_generator():
            if state["stopped"]:
                break
                
            # Handle seeking
            if state["seek_frame"] is not None:
                processor.seek_target = state["seek_frame"]
                state["seek_frame"] = None

            # Handle pauses
            while state["paused"] and not state["stopped"]:
                # Support seeking while paused
                if state["seek_frame"] is not None:
                    processor.seek_target = state["seek_frame"]
                    state["seek_frame"] = None
                    break
                await asyncio.sleep(0.1)
                
            if state["stopped"]:
                break

            # Send the frame telemetry package
            await websocket.send_json(frame_data)
            
            # Control frame rate based on input video FPS and speed multiplier
            fps = processor.fps_input if processor.fps_input > 0 else 25.0
            delay = 1.0 / fps
            delay = delay / state["speed"]
            
            # Prevent extreme speed sleep crashes
            await asyncio.sleep(max(0.001, delay))
            
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        state["stopped"] = True
        listener_task.cancel()
        try:
            await websocket.close()
        except:
            pass

# Serve static frontend files
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
