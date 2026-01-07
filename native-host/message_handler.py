"""
Message handler for R34 Tools native host
Routes incoming messages to appropriate database operations
"""

import logging


class MessageHandler:
    """Routes and handles messages from the extension"""

    def __init__(self, database):
        """
        Initialize message handler with database instance

        Args:
            database (Database): Database instance for operations
        """
        self.db = database
        self.handlers = {
            'checkDuplicate': self.check_duplicate,
            'recordDownload': self.record_download,
            'getStats': self.get_stats,
            'fileExists': self.file_exists
        }

    def handle(self, message):
        """
        Route message to appropriate handler

        Args:
            message (dict): Message from extension with 'action' and 'data' keys

        Returns:
            dict: Response with 'success', 'data', and 'error' keys
        """
        action = message.get('action')
        data = message.get('data', {})

        if action not in self.handlers:
            return {
                'success': False,
                'error': f'Unknown action: {action}',
                'data': None
            }

        try:
            handler = self.handlers[action]
            result = handler(data)
            return {
                'success': True,
                'data': result,
                'error': None
            }
        except Exception as e:
            logging.error(f"Handler error for {action}: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'data': None
            }

    def check_duplicate(self, data):
        """
        Check if post is already downloaded

        Args:
            data (dict): Data with 'postId' key

        Returns:
            dict: Duplicate info with isDuplicate flag and download details if found

        Raises:
            ValueError: If postId is missing
        """
        post_id = data.get('postId')
        if not post_id:
            raise ValueError('postId is required')

        result = self.db.check_duplicate(post_id)

        if result:
            return {
                'isDuplicate': True,
                **result
            }
        else:
            return {
                'isDuplicate': False
            }

    def record_download(self, data):
        """
        Record a successful download

        Args:
            data (dict): Download data with required keys: postId, filename,
                        filePath, mediaUrl

        Returns:
            dict: Record info with id and postId

        Raises:
            ValueError: If required fields are missing
        """
        required = ['postId', 'filename', 'filePath', 'mediaUrl']
        for field in required:
            if field not in data:
                raise ValueError(f'{field} is required')

        row_id = self.db.record_download(data)

        return {
            'id': row_id,
            'postId': data['postId']
        }

    def get_stats(self, data):
        """
        Get database statistics

        Args:
            data (dict): Unused, for API consistency

        Returns:
            dict: Database statistics
        """
        return self.db.get_stats()

    def file_exists(self, data):
        """
        Check if file exists on disk

        Args:
            data (dict): Data with 'filePath' key

        Returns:
            dict: File existence info

        Raises:
            ValueError: If filePath is missing
        """
        file_path = data.get('filePath')
        if not file_path:
            raise ValueError('filePath is required')

        return self.db.file_exists(file_path)
