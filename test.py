# ============================================================
#  EDIT THIS FILE TO CHANGE THE VIDEO TOPIC
# ============================================================

TOPIC = "Backpropagation in Neural Networks"

# Choose client: "gemini" or "claude"
CLIENT = "gemini" 

# ============================================================
#  Then run:  python main.py
# ============================================================

from main import run
run(TOPIC, client=CLIENT)
