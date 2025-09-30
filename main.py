from app import app
import routes  # Keep existing routes for compatibility

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
