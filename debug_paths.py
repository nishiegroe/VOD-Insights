from app.runtime_paths import get_react_dist
import os

dist = get_react_dist()
print(f"REACT_DIST resolves to: {dist}")
print(f"Current working dir: {os.getcwd()}")
print(f"Dist exists: {dist.exists()}")

index = dist / "index.html"
print(f"index.html path: {index}")
print(f"index.html exists: {index.exists()}")

if index.exists():
    content = index.read_text()
    print(f"Has MODIFIED-TEST: {'MODIFIED-TEST' in content}")
    print(f"Has CQltkhsb: {'CQltkhsb' in content}")
    print(f"Has BC1L51kn: {'BC1L51kn' in content}")
    print(f"\nFirst 300 chars:\n{content[:300]}")
