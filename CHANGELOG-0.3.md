# MiniOS Release Foundation 0.3 — changes

- Added native App Center, Terminal, Settings and System Information screens.
- Added a limited in-kernel command console with `help`, `about`, `clear`, `sysinfo`, `apps` and `reboot`.
- Added a live-session accent-color toggle.
- Expanded desktop navigation and made keyboard shortcuts explicit.
- Kept installer disk writes disabled because no storage backend exists; this prevents a fake installer from damaging user data.
- Updated documentation to distinguish kernel compilation from ISO/boot testing and to list commercial release blockers.

## Verification performed

- `make clean && make kernel` succeeds with the available Clang and LLD toolchain in the build environment.
- The complete ISO was not built here because `xorriso` and QEMU are not installed in the environment.
- No physical hardware, storage driver, real installation, or commercial release validation has been tested.
