# MiniOS Release Foundation 0.5 — framebuffer boot fix

- Switched the Limine menu entry to `protocol: multiboot2`.
- Added a Multiboot2 header with the framebuffer request tag for 1024x768x32.
- Added bounded Multiboot2 tag parsing for the framebuffer response.
- The kernel now requires a valid RGB 32-bpp framebuffer before drawing.

Validation: kernel compilation/linking and archive integrity checked in the current build environment. Full ISO generation and VM boot still need testing in the Windows/MSYS2 environment.
