# ============================================================
#  EDIT THIS FILE TO CHANGE THE VIDEO TOPIC
# ============================================================

TOPIC = "Bubble Sort"

# Choose client: "gemini" or "claude"
CLIENT = "claude" 

# ============================================================
#  Then run:  python main.py
# ============================================================

from main import run
run(TOPIC, client=CLIENT)
