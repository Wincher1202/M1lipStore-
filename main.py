import os
import sys
import runpy

# Ensure main directory is in sys.path so relative imports work seamlessly
root_dir = os.path.dirname(os.path.abspath(__file__))
main_dir = os.path.join(root_dir, "main")

if main_dir not in sys.path:
    sys.path.insert(0, main_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

if __name__ == "__main__":
    target_script = os.path.join(main_dir, "main.py")
    runpy.run_path(target_script, run_name="__main__")
