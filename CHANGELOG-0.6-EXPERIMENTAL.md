# MiniOS 0.6 — experimental diagnostics

This package is an experimental diagnostic revision, not a verified fix for a VirtualBox process crash.

- Keeps the Multiboot2 protocol and framebuffer request.
- If a valid framebuffer is missing, shows VGA text with the received boot magic and information pointer instead of a generic one-line message.
- Rebuilds the kernel from source; stale build objects are not required.

The VirtualBox log tail previously provided contained only shutdown statistics and did not identify the cause of the VM termination. The kernel cannot repair a VirtualBox host-side crash by itself.
