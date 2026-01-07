#!/usr/bin/env python3
"""
Installation script for R34 Tools native messaging host
Handles cross-platform installation of the native host and manifest
"""

import sys
import json
import platform
import shutil
import os
from pathlib import Path

NATIVE_HOST_NAME = 'com.r34tools.native_host'
EXTENSION_ID = 'r34-tools@r34tools.local'


def get_manifest_dir():
    """Get OS-specific manifest installation directory"""
    system = platform.system()

    if system == 'Windows':
        return Path.home() / 'AppData' / 'Roaming' / 'Mozilla' / 'NativeMessagingHosts'
    elif system == 'Darwin':  # macOS
        return Path.home() / 'Library' / 'Application Support' / 'Mozilla' / 'NativeMessagingHosts'
    else:  # Linux
        return Path.home() / '.mozilla' / 'native-messaging-hosts'


def get_host_dir():
    """Get installation directory for host scripts"""
    system = platform.system()

    if system == 'Windows':
        return Path.home() / 'AppData' / 'Local' / 'R34Tools'
    else:
        return Path.home() / '.local' / 'share' / 'r34tools'


def create_manifest(host_script_path):
    """
    Create native messaging host manifest

    Args:
        host_script_path (Path): Path to the launcher script

    Returns:
        dict: Manifest JSON structure
    """
    return {
        'name': NATIVE_HOST_NAME,
        'description': 'Native messaging host for R34 Tools extension',
        'path': str(host_script_path),
        'type': 'stdio',
        'allowed_extensions': [EXTENSION_ID]
    }


def install():
    """Install native messaging host"""
    print("R34 Tools Native Messaging Host Installer")
    print("=" * 50)
    print()

    # Get directories
    manifest_dir = get_manifest_dir()
    host_dir = get_host_dir()

    print(f"Manifest directory: {manifest_dir}")
    print(f"Host directory: {host_dir}")
    print()

    # Create directories
    manifest_dir.mkdir(parents=True, exist_ok=True)
    host_dir.mkdir(parents=True, exist_ok=True)
    print(f"✓ Created directories")

    # Copy Python scripts
    script_dir = Path(__file__).parent
    files_to_copy = [
        'r34_native_host.py',
        'database.py',
        'message_handler.py'
    ]

    for file in files_to_copy:
        src = script_dir / file
        dst = host_dir / file
        if src.exists():
            shutil.copy2(src, dst)
            print(f"  ✓ Copied {file}")
        else:
            print(f"  ✗ Warning: {file} not found, skipping")

    # Create launcher script
    system = platform.system()
    if system == 'Windows':
        launcher_path = host_dir / 'r34_host.bat'
        launcher_content = f'@echo off\npython "%~dp0r34_native_host.py"\n'
    else:
        launcher_path = host_dir / 'r34_host.sh'
        # Use python3 for Linux/macOS, and use the directory containing the script
        launcher_content = f'#!/bin/bash\npython3 "$(dirname "$0")/r34_native_host.py"\n'

    launcher_path.write_text(launcher_content)
    if system != 'Windows':
        launcher_path.chmod(0o755)
    print(f"✓ Created launcher: {launcher_path}")

    # Create manifest
    manifest = create_manifest(launcher_path)
    manifest_path = manifest_dir / f'{NATIVE_HOST_NAME}.json'
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"✓ Created manifest: {manifest_path}")

    print()
    print("=" * 50)
    print("Installation complete!")
    print()
    print("Next steps:")
    print("1. Restart Firefox")
    print("2. Navigate to rule34.xxx")
    print("3. Open R34 Tools extension options")
    print("4. Enable 'Enable Native Host' checkbox")
    print("5. Click 'Test Connection' button")
    print("6. Status should show 'Connected' (green)")
    print()
    print(f"Logs will be written to:")
    if system == 'Windows':
        print(f"  {Path(os.getenv('APPDATA')) / 'R34Tools' / 'logs' / 'native_host.log'}")
    else:
        print(f"  {Path.home() / '.r34tools' / 'logs' / 'native_host.log'}")
    print()
    print(f"Database will be created at:")
    if system == 'Windows':
        print(f"  {Path(os.getenv('APPDATA')) / 'R34Tools' / 'r34_data.db'}")
    else:
        print(f"  {Path.home() / '.r34tools' / 'r34_data.db'}")


def uninstall():
    """Uninstall native messaging host"""
    print("R34 Tools Native Messaging Host Uninstaller")
    print("=" * 50)
    print()

    manifest_dir = get_manifest_dir()
    manifest_path = manifest_dir / f'{NATIVE_HOST_NAME}.json'

    if manifest_path.exists():
        manifest_path.unlink()
        print(f"✓ Removed manifest: {manifest_path}")
    else:
        print(f"✗ Manifest not found: {manifest_path}")

    print()
    print("=" * 50)
    print("Uninstallation complete!")
    print()
    print("Note: Host directory, database, and logs were preserved.")
    print("To remove them manually:")
    host_dir = get_host_dir()
    print(f"  Host directory: {host_dir}")
    system = platform.system()
    if system == 'Windows':
        db_dir = Path(os.getenv('APPDATA')) / 'R34Tools'
    else:
        db_dir = Path.home() / '.r34tools'
    print(f"  Database/logs: {db_dir}")


def main():
    """Main entry point"""
    if '--uninstall' in sys.argv:
        uninstall()
    else:
        install()


if __name__ == '__main__':
    main()
