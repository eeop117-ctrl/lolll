# MiniOS migration plan

The current build path is Windows-hosted and does not use Linux/WSL. `build.bat` installs/checks the MSYS2 Windows toolchain and invokes the Makefile.

## Current kernel stage
- Freestanding C kernel, x86 32-bit, Multiboot 1.
- Limine BIOS boot and ISO creation via xorriso.
- VGA text screen and PS/2 keyboard polling.

## Next stages
1. Test the ISO in QEMU/VirtualBox BIOS mode.
2. Add interrupt handling, timer, and memory management.
3. Add a framebuffer graphics subsystem and mouse support.
4. Design a filesystem and app/runtime interface.
5. Port selected HTML UI concepts to native C drawing/widgets; the old browser UI remains a reference, not part of the kernel.
