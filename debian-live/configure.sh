#!/bin/sh
set -eu
[ -f auto ] && rm -f auto
lb config noauto \
  --mode debian \
  --distribution bookworm \
  --architectures amd64 \
  --binary-images iso-hybrid \
  --archive-areas "main contrib non-free-firmware" \
  --bootappend-live "boot=live components username=minios hostname=minios locales=en_US.UTF-8 keyboard-layouts=us" \
  --debian-installer none \
  --iso-application "MiniOS" \
  --iso-publisher "MiniOS Project" \
  --iso-volume "MINIOS_09" \
  --apt-recommends true
