# MiniOS 0.8 — Graphical Shell + Mandatory First-Run Setup

## Start the graphical shell
1. Extract the entire ZIP.
2. Open `legacy-ui-reference/Claude/START-MINIOS-DESKTOP.bat` (or double-click `index.html`).
3. Complete the mandatory first-run setup wizard. The desktop is blocked until setup is completed.

The shell is a browser-based desktop prototype bundled with this project. It includes the existing interactive desktop/apps from the source project. The wizard saves a first-run flag and preferences in the browser's local storage. Clearing the site's browser data resets the wizard.

## Bootable ISO / kernel
Run `build.bat` to build the separate experimental Multiboot2 kernel ISO. The ISO in this version remains the text-mode diagnostic kernel; the browser shell is bundled as project files and is **not embedded as a native graphical desktop in the ISO**. A browser engine, graphics/input drivers, disk driver, filesystem and a real disk installer are not implemented in the kernel.

## Installer limitation
The mandatory wizard is a first-run setup for the browser shell. It does not write to HDD/SSD, partition disks, or install the bootable ISO. The wizard says this before completion. A safe real OS installer requires a disk driver and filesystem implementation and must not pretend to install without them.
