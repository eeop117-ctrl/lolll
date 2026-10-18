#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/debian-live"
sudo apt-get update
sudo apt-get install -y live-build debootstrap squashfs-tools xorriso debian-archive-keyring mtools dosfstools syslinux-utils isolinux syslinux-common
sudo lb clean --purge || true
chmod +x configure.sh config/includes.chroot/usr/local/bin/* config/includes.chroot/opt/minios/installer/backend.py
sudo sh ./configure.sh
sudo lb build
echo "Build directory: $(pwd)"
