#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/debian-live"
sudo apt-get update
sudo apt-get install -y live-build debootstrap squashfs-tools xorriso
sudo lb clean --purge || true
chmod +x auto config/includes.chroot/usr/local/bin/* config/includes.chroot/opt/minios/installer/backend.py
sudo sh ./auto
sudo lb build
echo "Build directory: $(pwd)"
