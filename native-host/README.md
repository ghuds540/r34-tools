# R34 Tools Native Messaging Host

This native messaging host enables advanced features for the R34 Tools Firefox extension:

- **Duplicate Detection**: Automatically prevents re-downloading posts you've already saved
- **Download Tracking**: SQLite database tracking all downloads with metadata (post ID, artists, tags, timestamps)
- **File Verification**: Checks if downloaded files still exist on disk
- **Persistent Storage**: Data persists across browser sessions

## Prerequisites

- **Python 3.7 or higher** installed and accessible from command line
- **R34 Tools Firefox extension** installed
- **Firefox** (obviously!)

## Installation

### Windows

1. Open Command Prompt or PowerShell
2. Navigate to this directory:
   ```cmd
   cd C:\path\to\r34-tools\native-host
   ```
3. Run the installation script:
   ```cmd
   python install.py
   ```
4. **Restart Firefox** (important!)
5. Navigate to `rule34.xxx`
6. Open R34 Tools extension options (click extension icon → Options)
7. Find the "Native Host (Duplicate Detection)" section
8. Enable the "Enable Native Host" checkbox
9. Click "Test Connection" button
10. Status should show **"Connected"** (green)

### Linux

1. Open terminal
2. Navigate to this directory:
   ```bash
   cd ~/path/to/r34-tools/native-host
   ```
3. Run the installation script:
   ```bash
   python3 install.py
   ```
4. **Restart Firefox**
5. Navigate to `rule34.xxx`
6. Open R34 Tools extension options
7. Enable "Enable Native Host" checkbox
8. Click "Test Connection" → should show "Connected"

### macOS

1. Open Terminal
2. Navigate to this directory:
   ```bash
   cd ~/path/to/r34-tools/native-host
   ```
3. Run the installation script:
   ```bash
   python3 install.py
   ```
4. **Restart Firefox**
5. Navigate to `rule34.xxx`
6. Open R34 Tools extension options
7. Enable "Enable Native Host" checkbox
8. Click "Test Connection" → should show "Connected"

## Testing

After installation and enabling the native host:

1. Navigate to `rule34.xxx`
2. Download any post (click download button on thumbnail or use Ctrl+Q on post page)
3. The download should succeed normally
4. Try downloading the **same post again**
5. You should see a notification: **"Already downloaded: filename.jpg"**
6. The duplicate download should be prevented

## File Locations

### Database

The SQLite database stores all download records:

- **Windows**: `%APPDATA%\R34Tools\r34_data.db`
- **Linux**: `~/.r34tools/r34_data.db`
- **macOS**: `~/.r34tools/r34_data.db`

You can query the database directly using `sqlite3`:

```bash
# View all downloads
sqlite3 ~/.r34tools/r34_data.db "SELECT post_id, filename, artists, downloaded_at FROM downloads ORDER BY downloaded_at DESC LIMIT 10;"

# Count total downloads
sqlite3 ~/.r34tools/r34_data.db "SELECT COUNT(*) FROM downloads;"

# Find downloads by artist
sqlite3 ~/.r34tools/r34_data.db "SELECT filename FROM downloads WHERE artists LIKE '%artist_name%';"
```

### Logs

Native host logs are written to:

- **Windows**: `%APPDATA%\R34Tools\logs\native_host.log`
- **Linux**: `~/.r34tools/logs/native_host.log`
- **macOS**: `~/.r34tools/logs/native_host.log`

Check logs if you encounter issues:

```bash
# View latest log entries (Linux/macOS)
tail -f ~/.r34tools/logs/native_host.log

# View latest log entries (Windows PowerShell)
Get-Content "$env:APPDATA\R34Tools\logs\native_host.log" -Tail 20
```

### Manifest

The native messaging host manifest is installed at:

- **Windows**: `%APPDATA%\Mozilla\NativeMessagingHosts\com.r34tools.native_host.json`
- **Linux**: `~/.mozilla/native-messaging-hosts/com.r34tools.native_host.json`
- **macOS**: `~/Library/Application Support/Mozilla/NativeMessagingHosts/com.r34tools.native_host.json`

## Troubleshooting

### "Not Connected" Status

If the Test Connection button shows "Not Connected" (red):

1. **Verify Python is installed and in PATH**:
   ```bash
   python --version   # Windows
   python3 --version  # Linux/macOS
   ```
   Should show Python 3.7 or higher.

2. **Check manifest file exists**:
   - Windows: `dir "%APPDATA%\Mozilla\NativeMessagingHosts\com.r34tools.native_host.json"`
   - Linux/macOS: `ls ~/.mozilla/native-messaging-hosts/com.r34tools.native_host.json`

3. **Check Browser Console for errors**:
   - Open Firefox Developer Tools (F12)
   - Go to Console tab
   - Look for messages containing "[R34 Tools]" or "native messaging"
   - Common error: "No such native application com.r34tools.native_host"
     - Solution: Restart Firefox after installation

4. **Check native host logs**:
   ```bash
   # Linux/macOS
   cat ~/.r34tools/logs/native_host.log

   # Windows PowerShell
   Get-Content "$env:APPDATA\R34Tools\logs\native_host.log"
   ```
   If log file doesn't exist or is empty, the host isn't starting.

5. **Try reinstalling**:
   ```bash
   python install.py --uninstall
   python install.py
   ```
   Then restart Firefox.

### Permission Errors (Linux/macOS)

If you get permission denied errors:

```bash
# Make launcher script executable
chmod +x ~/.local/share/r34tools/r34_host.sh

# Check launcher script is executable
ls -l ~/.local/share/r34tools/r34_host.sh
```

Should show `-rwxr-xr-x` (x = executable).

### Database Errors

If you see database-related errors in logs:

1. **Check database location and permissions**:
   ```bash
   # Linux/macOS
   ls -la ~/.r34tools/r34_data.db

   # Windows PowerShell
   Get-Item "$env:APPDATA\R34Tools\r34_data.db"
   ```

2. **Test database manually**:
   ```bash
   sqlite3 ~/.r34tools/r34_data.db "SELECT * FROM metadata;"
   ```

3. **Reset database** (last resort - deletes all download records):
   ```bash
   # Linux/macOS
   rm ~/.r34tools/r34_data.db

   # Windows PowerShell
   Remove-Item "$env:APPDATA\R34Tools\r34_data.db"
   ```
   The database will be recreated on next use.

### Extension Still Works Without Native Host

This is **normal**! The extension is designed to work with or without the native host. If the native host is unavailable:

- Downloads still work normally
- Duplicate detection is skipped
- No download records are saved to database

Enable "Enable Native Host" checkbox in options to activate duplicate detection.

## Uninstallation

To uninstall the native host:

```bash
python install.py --uninstall
```

This removes the manifest file but **preserves**:
- Database (`r34_data.db`) with all download records
- Logs directory
- Host application files

To completely remove everything:

```bash
# Uninstall manifest
python install.py --uninstall

# Remove database and logs (Linux/macOS)
rm -rf ~/.r34tools

# Remove database and logs (Windows PowerShell)
Remove-Item -Recurse "$env:APPDATA\R34Tools"
```

## How It Works

### Message Flow

1. User clicks download button on thumbnail
2. Extension extracts post ID from URL
3. Extension sends `checkDuplicate` message to background script
4. Background script forwards to native host via `browser.runtime.sendNativeMessage()`
5. Native host queries SQLite database for post ID
6. If found: Native host responds with duplicate info + file existence check
7. If not found: Download proceeds normally
8. After successful download: Extension sends `recordDownload` message
9. Native host records post ID, filename, artists, timestamp in database

### Security

- **Extension ID validation**: Native host only accepts connections from `r34-tools@r34tools.local`
- **SQL injection prevention**: All database operations use parameterized queries
- **File path validation**: Only records paths from browser.downloads API
- **No network access**: Database is local-only
- **Read-only file checks**: Native host only checks file existence, never writes/deletes

### Performance

- **Duplicate check**: < 10ms (indexed SQLite lookup)
- **Record download**: < 15ms (SQLite insert)
- **Total overhead**: < 30ms per download (negligible)
- **Database size**: ~100 KB per 1,000 downloads
- **Memory**: ~20-30 MB for Python process (stays running while Firefox is open)

## Future Features (Planned)

- **Saved pages**: Store saved pages in database instead of JSON files
- **Seen posts tracking**: Remember which posts you've viewed
- **Hidden posts**: Hide posts you don't want to see again
- **Visual indicators**: Show checkmark on thumbnails for already-downloaded posts
- **Batch operations**: Query multiple post IDs at once for better performance
- **Statistics UI**: Browse download history, filter by artist/tag, export data

## Support

If you encounter issues:

1. Check logs: `~/.r34tools/logs/native_host.log` (Linux/macOS) or `%APPDATA%\R34Tools\logs\native_host.log` (Windows)
2. Check Browser Console (F12) for errors
3. Try reinstalling: `python install.py --uninstall && python install.py`
4. Open an issue on GitHub with:
   - Your OS and Python version
   - Contents of native host log
   - Any error messages from Browser Console

## Technical Details

### Files

- `r34_native_host.py`: Main application, implements stdin/stdout message protocol
- `database.py`: SQLite database operations (create tables, check duplicates, record downloads)
- `message_handler.py`: Routes messages to appropriate handlers
- `install.py`: Installation script for cross-platform setup
- `manifests/r34_tools_host.json`: Template for native messaging host manifest

### Database Schema

```sql
CREATE TABLE downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    media_url TEXT NOT NULL,
    hash TEXT,
    artists TEXT,  -- JSON array
    tags TEXT,     -- JSON array
    downloaded_at TEXT NOT NULL,
    file_size INTEGER,
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Message Protocol

All messages use JSON format with stdin/stdout binary protocol:

**Request**:
```json
{
  "action": "checkDuplicate",
  "data": {
    "postId": "12345678"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "isDuplicate": true,
    "filename": "r34_12345678_abc123_artist1.jpg",
    "filePath": "C:\\Users\\user\\Downloads\\r34_12345678_abc123_artist1.jpg",
    "fileExists": true,
    "downloadedAt": "2026-01-07T12:34:56Z",
    "artists": ["artist1"]
  },
  "error": null
}
```
