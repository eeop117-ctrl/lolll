# Native Windows build through MSYS2 tools (no WSL/Linux distribution).
CC := clang --target=i386-unknown-none-elf
LD := ld.lld
BUILD := build
LIMINE_DIR := tools/limine
CFLAGS := -m32 -std=gnu11 -O2 -Wall -Wextra -Werror -ffreestanding -fno-pie -fno-stack-protector -fno-asynchronous-unwind-tables -fno-unwind-tables -fno-builtin
ASFLAGS := -m32 -ffreestanding -fno-pie
LDFLAGS := -m elf_i386 -T kernel/linker.ld -nostdlib

.PHONY: all kernel iso clean check-tools iso-tools limine
all: iso

check-tools:
	@command -v clang >/dev/null || (echo "Нужен clang из MSYS2"; exit 1)
	@command -v ld.lld >/dev/null || (echo "Нужен lld из MSYS2"; exit 1)
	@ld.lld --version >/dev/null 2>&1 || (echo "ОШИБКА: ld.lld найден, но не запускается. Переустанови пакеты UCRT64 LLVM/LLD."; exit 1)

iso-tools: check-tools
	@command -v xorriso >/dev/null || (echo "Нужен xorriso из MSYS2"; exit 1)
	@command -v git >/dev/null || (echo "Нужен git из MSYS2"; exit 1)

$(BUILD):
	mkdir -p $(BUILD)

$(BUILD)/boot.o: kernel/boot.S | $(BUILD)
	$(CC) $(ASFLAGS) -c $< -o $@

$(BUILD)/kernel.o: kernel/kernel.c | $(BUILD)
	$(CC) $(CFLAGS) -c $< -o $@

kernel: check-tools $(BUILD)/boot.o $(BUILD)/kernel.o
	$(LD) $(LDFLAGS) -o $(BUILD)/kernel.elf $(BUILD)/boot.o $(BUILD)/kernel.o
	@echo "Ядро готово: $(BUILD)/kernel.elf"

$(LIMINE_DIR)/limine-bios-cd.bin:
	# Use a pinned Limine binary release tag for reproducible downloads.
	rm -rf $(LIMINE_DIR)
	mkdir -p tools
	git clone --depth 1 --branch=v9.2.3-binary https://github.com/Limine-Bootloader/Limine.git $(LIMINE_DIR)

limine: $(LIMINE_DIR)/limine-bios-cd.bin
	@test -f $(LIMINE_DIR)/limine-bios.sys || (echo "В пакете Limine нет limine-bios.sys"; exit 1)
	@test -f $(LIMINE_DIR)/limine.exe || (echo "В пакете Limine нет limine.exe"; exit 1)

iso: iso-tools kernel limine
	rm -rf $(BUILD)/iso
	mkdir -p $(BUILD)/iso/boot
	cp $(BUILD)/kernel.elf $(BUILD)/iso/boot/kernel.elf
	cp iso/limine.conf $(BUILD)/iso/limine.conf
	cp $(LIMINE_DIR)/limine-bios.sys $(BUILD)/iso/boot/limine-bios.sys
	cp $(LIMINE_DIR)/limine-bios-cd.bin $(BUILD)/iso/boot/limine-bios-cd.bin
	xorriso -as mkisofs -R -r -J -b boot/limine-bios-cd.bin -no-emul-boot -boot-load-size 4 -boot-info-table -o $(BUILD)/minios-c.iso $(BUILD)/iso
	$(LIMINE_DIR)/limine.exe bios-install $(BUILD)/minios-c.iso
	@echo "ISO готов: $(BUILD)/minios-c.iso"

clean:
	rm -rf $(BUILD)
