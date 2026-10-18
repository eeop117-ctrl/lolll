# Commercial readiness checklist

This file is deliberately explicit so the project is not marketed as finished before it is safe and testable.

## Current status

- [x] Freestanding x86 kernel compiles with Clang/LLD in the available test environment.
- [x] Native framebuffer shell with multiple screens.
- [x] Basic PS/2 keyboard polling and safe built-in console commands.
- [ ] Reproducible ISO build verified on a clean Windows/MSYS2 installation.
- [ ] Boot verified in QEMU/VirtualBox and on supported physical hardware.
- [ ] CPU exception handlers, IDT, timer interrupts, and panic diagnostics.
- [ ] Physical/virtual memory manager and allocator.
- [ ] Robust keyboard driver; mouse support.
- [ ] PCI enumeration and documented hardware support matrix.
- [ ] Storage drivers (at least a supported virtual disk path) and block-device layer.
- [ ] Filesystem with tested read/write behavior and corruption recovery.
- [ ] Real installer with target-disk identification, destructive-action confirmation, partitioning, formatting, copy, bootloader install, and failure recovery.
- [ ] Persistent settings and a real file manager.
- [ ] Application loading, process model, and isolation.
- [ ] Network stack, TLS strategy, updates, and security response process if networking is shipped.
- [ ] Accessibility, localization, usability, crash, and upgrade tests.
- [ ] License audit, third-party notices, trademarks, privacy policy, and distribution terms.
- [ ] Release signing, checksums, build provenance, and recovery media.

## Installer safety rule

Do not enable destructive disk writes until disk enumeration and partitioning are implemented and tested against disposable virtual disks. A real installer must never select or erase a disk silently.
