# ============================================================
#  EDIT THIS FILE TO CHANGE THE VIDEO TOPIC
# ============================================================

TOPIC = "Backpropagation in Neural Networks"

# Choose client: "gemini", "claude", or "nvidia"
CLIENT = "gemini"

# ============================================================
#  Then run:  python test.py
# ============================================================

from main import run
run(TOPIC, client=CLIENT)
