#!/usr/bin/bash
set -euo pipefail

# MINI OS BUILD SCRIPT VERSION: 2026-10-18-FIXED-PATH
# Run from the project root established by build.bat. Do not use dirname.
PROJECT_DIR="$PWD"
if [ ! -f "$PROJECT_DIR/Makefile" ]; then
  echo "ERROR: Project root not found: $PROJECT_DIR"
  echo "Extract the entire ZIP into a new folder and run build.bat from there."
  exit 1
fi
cd "$PROJECT_DIR"

# Use the UCRT64 toolchain path as well as MSYS system utilities.
export PATH="/ucrt64/bin:/usr/bin:$PATH"

if ! command -v pacman >/dev/null 2>&1; then
  echo "ERROR: MSYS2 pacman was not found. Reinstall MSYS2 to C:\msys64."
  exit 1
fi

echo "Installing/checking required MSYS2 packages..."
pacman -S --needed --noconfirm base-devel coreutils git make xorriso \
  mingw-w64-ucrt-x86_64-clang mingw-w64-ucrt-x86_64-lld mingw-w64-ucrt-x86_64-llvm

command -v clang >/dev/null 2>&1 || { echo "ERROR: clang is still missing after package install."; exit 1; }
command -v ld.lld >/dev/null 2>&1 || { echo "ERROR: ld.lld is still missing after package install."; exit 1; }
ld.lld --version >/dev/null 2>&1 || { echo "ERROR: ld.lld is present but cannot launch. Reinstall the MSYS2 UCRT64 LLVM/LLD packages."; exit 1; }
command -v make >/dev/null 2>&1 || { echo "ERROR: make is still missing after package install."; exit 1; }
command -v xorriso >/dev/null 2>&1 || { echo "ERROR: xorriso is still missing after package install."; exit 1; }

# FIX: pass PATH explicitly into make so ld.lld is found inside recipe shells
make iso PATH="$PATH"
