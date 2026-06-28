import os
import sys
import subprocess
import time
import threading
import webbrowser

def open_browser():
    # Wait for the server to start up
    time.sleep(1.5)
    url = "http://localhost:8000"
    print(f"\n[AeroFlow] Launching web browser pointing to: {url}")
    webbrowser.open(url)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Determine Python and Uvicorn path in Virtual Environment
    if os.name == 'nt': # Windows
        python_exe = os.path.join(base_dir, "venv", "Scripts", "python.exe")
        uvicorn_exe = os.path.join(base_dir, "venv", "Scripts", "uvicorn.exe")
    else: # Mac/Linux
        python_exe = os.path.join(base_dir, "venv", "bin", "python")
        uvicorn_exe = os.path.join(base_dir, "venv", "bin", "uvicorn")

    # 2. Check if virtual environment exists
    if not os.path.exists(python_exe):
        print(f"[Error] Virtual environment not found at {python_exe}.")
        print("Please run dependencies setup first or install manually.")
        sys.exit(1)

    print("[AeroFlow] Starting FastAPI Backend server...")
    
    # 3. Start thread to open browser shortly after launch
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()

    # 4. Start Uvicorn Server
    try:
        subprocess.run([
            uvicorn_exe,
            "backend.server:app",
            "--host", "127.0.0.1",
            "--port", "8000",
            "--reload"
        ], cwd=base_dir, check=True)
    except KeyboardInterrupt:
        print("\n[AeroFlow] Server stopped by user request. Goodbye!")
    except Exception as e:
        print(f"\n[Error] Failed to run uvicorn server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
