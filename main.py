"""Entrypoint for Render and direct execution.
Imports and runs the application from the main folder.
"""
import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
main_folder = os.path.join(current_dir, "main")

if main_folder not in sys.path:
    sys.path.insert(0, main_folder)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

import asyncio
from main.main import app, main

if __name__ == "__main__":
    asyncio.run(main())
