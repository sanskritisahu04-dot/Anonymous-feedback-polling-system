
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import hmac

app = Flask(__name__)
CORS(app)

DATABASE = "openvoice.db"
MODERATOR_PASSWORD = os.environ.get("MODERATOR_PASSWORD")

POLL_OPTIONS = [
    "More community events",
    "Better communication",
    "New activities",
    "More feedback opportunities"
]


def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                likes INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                option_id INTEGER NOT NULL,
                voter_token TEXT NOT NULL UNIQUE
            )
        """)


def post_dict(row):
    return {
        "id": row["id"],
        "text": row["text"],
        "likes": row["likes"],
        "time": row["created_at"]
    }


def moderator_authorized():
    supplied = request.headers.get("X-Moderator-Password", "")

    return (
        MODERATOR_PASSWORD is not None
        and bool(MODERATOR_PASSWORD)
        and hmac.compare_digest(supplied, MODERATOR_PASSWORD)
    )


@app.get("/api/health")
def health():
    return jsonify({"status": "OpenVoice API is running"})


# Retrieve all feedback posts
@app.get("/api/posts")
def get_posts():
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM posts ORDER BY id DESC"
        ).fetchall()

    return jsonify([post_dict(row) for row in rows])


# Create an anonymous post
@app.post("/api/posts")
def create_post():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")

    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Feedback text is required"}), 400

    text = text.strip()

    if len(text) > 1000:
        return jsonify({"error": "Maximum length is 1000 characters"}), 400

    with get_db() as db:
        cursor = db.execute(
            "INSERT INTO posts (text) VALUES (?)",
            (text,)
        )
        post_id = cursor.lastrowid

        row = db.execute(
            "SELECT * FROM posts WHERE id = ?",
            (post_id,)
        ).fetchone()

    return jsonify(post_dict(row)), 201


# Like a post
@app.post("/api/posts/<int:post_id>/like")
def like_post(post_id):
    with get_db() as db:
        cursor = db.execute(
            "UPDATE posts SET likes = likes + 1 WHERE id = ?",
            (post_id,)
        )

        if cursor.rowcount == 0:
            return jsonify({"error": "Post not found"}), 404

        row = db.execute(
            "SELECT * FROM posts WHERE id = ?",
            (post_id,)
        ).fetchone()

    return jsonify(post_dict(row))


# Retrieve poll options and results
@app.get("/api/poll")
def get_poll():
    with get_db() as db:
        rows = db.execute("""
            SELECT option_id, COUNT(*) AS total
            FROM votes
            GROUP BY option_id
        """).fetchall()

    totals = {row["option_id"]: row["total"] for row in rows}
    total_votes = sum(totals.values())

    results = []

    for index, option in enumerate(POLL_OPTIONS):
        count = totals.get(index, 0)

        results.append({
            "id": index,
            "option": option,
            "votes": count,
            "percentage": round(count * 100 / total_votes)
            if total_votes else 0
        })

    return jsonify({
        "question": "What should we improve next?",
        "total_votes": total_votes,
        "options": results
    })


# Record a poll vote
@app.post("/api/poll/vote")
def vote_poll():
    data = request.get_json(silent=True) or {}
    option_id = data.get("option_id")
    voter_token = data.get("voter_token")

    if (
        not isinstance(option_id, int)
        or isinstance(option_id, bool)
        or option_id not in range(len(POLL_OPTIONS))
    ):
        return jsonify({"error": "Invalid poll option"}), 400

    if (
        not isinstance(voter_token, str)
        or not 16 <= len(voter_token) <= 128
    ):
        return jsonify({"error": "A valid voter token is required"}), 400

    try:
        with get_db() as db:
            db.execute(
                "INSERT INTO votes (option_id, voter_token) VALUES (?, ?)",
                (option_id, voter_token)
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": "You have already voted"}), 409

    return get_poll()


# Remove a post: moderator only
@app.delete("/api/posts/<int:post_id>")
def delete_post(post_id):
    if not moderator_authorized():
        return jsonify({"error": "Moderator authorization required"}), 401

    with get_db() as db:
        cursor = db.execute(
            "DELETE FROM posts WHERE id = ?",
            (post_id,)
        )

        if cursor.rowcount == 0:
            return jsonify({"error": "Post not found"}), 404

    return jsonify({"message": "Post removed successfully"})


if __name__ == "__main__":
    initialize_database()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
