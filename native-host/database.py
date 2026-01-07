"""
SQLite database operations for R34 Tools native host
Handles download tracking, duplicate detection, and statistics
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path


class Database:
    """SQLite database manager for R34 Tools"""

    def __init__(self, db_path):
        """
        Initialize database connection and create tables if needed

        Args:
            db_path (str): Path to SQLite database file
        """
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._initialize_schema()

    def _initialize_schema(self):
        """Create tables and indexes if they don't exist"""
        cursor = self.conn.cursor()

        # Downloads table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id TEXT NOT NULL UNIQUE,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                media_url TEXT NOT NULL,
                hash TEXT,
                artists TEXT,
                tags TEXT,
                downloaded_at TEXT NOT NULL,
                file_size INTEGER,
                verified_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_downloads_post_id ON downloads(post_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_downloads_downloaded_at ON downloads(downloaded_at)")

        # Metadata table for settings and state
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Initialize metadata
        cursor.execute("INSERT OR IGNORE INTO metadata (key, value) VALUES ('schema_version', '1')")
        cursor.execute(
            "INSERT OR IGNORE INTO metadata (key, value) VALUES ('created_at', ?)",
            (datetime.utcnow().isoformat(),)
        )

        self.conn.commit()

    def check_duplicate(self, post_id):
        """
        Check if post_id exists in downloads table

        Args:
            post_id (str): Post ID to check

        Returns:
            dict: Download record if found, None otherwise
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT post_id, filename, file_path, downloaded_at, artists
            FROM downloads
            WHERE post_id = ?
        """, (post_id,))

        row = cursor.fetchone()
        if not row:
            return None

        # Check if file still exists on disk
        file_exists = Path(row['file_path']).exists()

        return {
            'postId': row['post_id'],
            'filename': row['filename'],
            'filePath': row['file_path'],
            'downloadedAt': row['downloaded_at'],
            'artists': json.loads(row['artists']) if row['artists'] else [],
            'fileExists': file_exists
        }

    def record_download(self, data):
        """
        Insert or update download record

        Args:
            data (dict): Download data with keys: postId, filename, filePath,
                        mediaUrl, artists, tags, hash

        Returns:
            int: Row ID of inserted/updated record
        """
        cursor = self.conn.cursor()

        artists_json = json.dumps(data.get('artists', []))
        tags_json = json.dumps(data.get('tags', []))
        now = datetime.utcnow().isoformat()

        cursor.execute("""
            INSERT INTO downloads
            (post_id, filename, file_path, media_url, hash, artists, tags, downloaded_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(post_id) DO UPDATE SET
                filename = excluded.filename,
                file_path = excluded.file_path,
                media_url = excluded.media_url,
                updated_at = excluded.updated_at
        """, (
            data['postId'],
            data['filename'],
            data['filePath'],
            data['mediaUrl'],
            data.get('hash', ''),
            artists_json,
            tags_json,
            now,
            now
        ))

        self.conn.commit()
        return cursor.lastrowid

    def get_stats(self):
        """
        Get database statistics

        Returns:
            dict: Statistics including total downloads, database size, date range
        """
        cursor = self.conn.cursor()

        cursor.execute("SELECT COUNT(*) as count FROM downloads")
        total_downloads = cursor.fetchone()['count']

        cursor.execute("SELECT MIN(downloaded_at) as oldest, MAX(downloaded_at) as newest FROM downloads")
        dates = cursor.fetchone()

        db_size = Path(self.db_path).stat().st_size

        return {
            'totalDownloads': total_downloads,
            'totalSavedPages': 0,  # Phase 2 feature
            'databaseSize': f"{db_size / (1024*1024):.2f} MB",
            'oldestDownload': dates['oldest'],
            'newestDownload': dates['newest']
        }

    def file_exists(self, file_path):
        """
        Check if file exists on disk

        Args:
            file_path (str): Path to file

        Returns:
            dict: File existence info with size and modified time if exists
        """
        path = Path(file_path)
        exists = path.exists()

        result = {
            'exists': exists
        }

        if exists:
            stat = path.stat()
            result['size'] = stat.st_size
            result['modified'] = datetime.fromtimestamp(stat.st_mtime).isoformat()

        return result

    def close(self):
        """Close database connection"""
        self.conn.close()
