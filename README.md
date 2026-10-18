# MiniOS 0.9 — Graphical Shell + Installer

Minimal hobby OS kernel for x86 (32-bit). Boots via Multiboot2 / Limine.

## What's included

- **VGA graphical shell** — desktop with icon navigation, window-style panels
- **Terminal** — built-in commands: help, ver, uname, mem, echo, clear, reboot, install
- **System Info** — hardware/software info panel
- **File Browser** — virtual filesystem viewer
- **Settings** — reboot/halt controls
- **Graphical Installer** — 4-step wizard: Welcome → Disk Select → Confirm → Progress

## Build (Windows, no WSL)

Requires MSYS2 at `C:\msys64`. Run:

```
build.bat
```

The script installs the required MSYS2 UCRT64 packages (clang, lld, xorriso, git)
and produces `build\minios-c.iso`.

### Fix applied in this build

`build-msys.sh` now passes `PATH="$PATH"` explicitly to `make` so that
`ld.lld` (in `/ucrt64/bin`) is found inside every Make recipe shell.
This fixes `Error 127: command not found` at the link step.

## Boot the ISO

Open in VirtualBox or QEMU in **Legacy BIOS mode** (not UEFI).

## Keyboard

| Key | Action |
|-----|--------|
| ← → or arrow keys | Navigate desktop icons |
| ENTER | Open selected item |
| ESC | Return to desktop |
| F1 | Desktop |
| F2 | Terminal |
| F3 | System Info |
| F5 | Installer |

## Installer

The installer UI is a full prototype. Disk write is not implemented in this
VGA-only kernel — for actual installation use the Debian Live config in
`debian-live/` or build via GitHub Actions (`build-linux-iso.sh`).

## 0.9 — установочный ISO (Debian Live + свой установщик)
`build.bat` собирает установочный ISO через GitHub Actions (нужны Git и GitHub CLI; Linux не нужен).
Старая сборка маленького ядра: `build-kernel.bat`.
Установщик: `debian-live/config/includes.chroot/opt/minios/installer/` (index.html + backend.py).
Тест интерфейса без записи на диск: откройте index.html двойным щелчком (демо-режим).

### Запуск .exe
В образ входят Wine (64- и 32-битные программы) и winetricks. Двойной щелчок по .exe запускает его через Wine; из терминала: `wine программа.exe`. Совместимость неполная: не пойдут программы с драйверами ядра, часть защит/античитов и некоторые игры.
