from flask import Flask, jsonify

app = Flask(__name__)

@app.get("/")
def home():
    return jsonify({
        "ok": True,
        "app": "Faction Xanax Insurance",
        "status": "running"
    })

@app.get("/health")
def health():
    return jsonify({"ok": True})
