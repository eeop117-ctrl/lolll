# MiniOS 0.9 — integrated graphical live system (experimental)

This source uses Debian Live + XFCE as the bootable OS base. The existing MiniOS HTML/JS shell is copied into `/opt/minios/shell` and launches as a local Chromium app inside the running Linux desktop. It is integrated into the booted system, but it is still a web-based shell rather than a native freestanding-kernel GUI.

## Included
- Debian Live amd64 build configuration and build scripts
- XFCE desktop, graphics stack and basic utilities
- MiniOS shell installed into the live filesystem
- Calamares package plus a live-session autostart entry
- GitHub Actions workflow to build and upload an ISO artifact

The Debian `calamares-settings-debian` package supplies version-matched installer modules and partitioning configuration; this project deliberately does not replace those module configs with placeholders.

## Build on Debian/Ubuntu
Run `./build-linux-iso.sh` from this project folder. Network access and several GB of free disk space are required. Windows users can use a Linux VM/WSL2 or GitHub Actions.

## Build using GitHub Actions
Push this project to GitHub, open Actions → Build MiniOS Live ISO → Run workflow. Download the ISO artifact from the completed run.

## Important
This source package and its config have not been boot-tested here, and I have not verified a successful disk installation. Package availability and Calamares behavior can vary by Debian mirror/version. Test only in a disposable VirtualBox VM with a blank virtual disk; never test against a disk containing important data. The installer must not erase anything until you explicitly confirm the target disk/partitioning.
