# MiniOS 0.7 — Clean Rewrite Baseline

- Replaced framebuffer drawing and framebuffer boot request with a minimal Multiboot2 kernel.
- Removed forced guest resolution from the kernel menu entry.
- Added VGA text UI and basic PS/2 keyboard navigation.
- Added safe terminal commands: `help`, `clear`, `info`, `about`.
- Added explicit Multiboot2 magic validation and visible boot error.
- Installer, disk writes, and nonimplemented drivers remain disabled.
