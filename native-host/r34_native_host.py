#!/usr/bin/env python3
"""
R34 Tools Native Messaging Host
Handles duplicate detection, download tracking, and page saving for the R34 Tools Firefox extension
"""

import sys
import json
import struct
import logging
import os
from pathlib import Path

from database import Database
from message_handler import MessageHandler


def setup_logging():
    """Setup logging to file in user's .r34tools directory"""
    if sys.platform == 'win32':
        log_dir = Path(os.getenv('APPDATA')) / 'R34Tools' / 'logs'
    else:
        log_dir = Path.home() / '.r34tools' / 'logs'

    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / 'native_host.log'

    logging.basicConfig(
        filename=str(log_file),
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    return log_file


def get_db_path():
    """Get OS-appropriate database path"""
    if sys.platform == 'win32':
        db_dir = Path(os.getenv('APPDATA')) / 'R34Tools'
    else:
        db_dir = Path.home() / '.r34tools'

    db_dir.mkdir(parents=True, exist_ok=True)
    return str(db_dir / 'r34_data.db')


def read_message():
    """
    Read message from stdin using Firefox native messaging protocol

    Returns:
        dict: Parsed JSON message, or None if EOF
    """
    # Read message length (4 bytes, little-endian unsigned int)
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None

    message_length = struct.unpack('=I', raw_length)[0]

    # Read message content
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def send_message(message):
    """
    Send message to stdout using Firefox native messaging protocol

    Args:
        message (dict): Message to send (will be JSON-encoded)
    """
    encoded_message = json.dumps(message).encode('utf-8')
    encoded_length = struct.pack('=I', len(encoded_message))

    sys.stdout.buffer.write(encoded_length)
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()


def main():
    """Main loop - read messages, process, respond"""
    log_file = setup_logging()
    logging.info("Native host started")
    logging.info(f"Log file: {log_file}")

    # Initialize database
    db_path = get_db_path()
    logging.info(f"Database path: {db_path}")

    try:
        db = Database(db_path)
        handler = MessageHandler(db)

        logging.info("Database initialized, entering message loop")

        while True:
            message = read_message()
            if message is None:
                logging.info("Received EOF, exiting")
                break

            action = message.get('action', 'unknown')
            logging.info(f"Received message: action={action}")

            response = handler.handle(message)

            logging.info(f"Sending response: success={response.get('success')}")
            send_message(response)

    except Exception as e:
        logging.error(f"Fatal error: {e}", exc_info=True)
        send_message({
            "success": False,
            "error": str(e),
            "data": None
        })
    finally:
        if 'db' in locals():
            db.close()
        logging.info("Native host stopped")


if __name__ == '__main__':
    main()
