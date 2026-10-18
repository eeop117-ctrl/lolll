/* MiniOS 0.7: minimal Multiboot2 entry. No framebuffer dependency. */
.set MB2_MAGIC, 0xE85250D6
.set MB2_ARCH, 0
.set MB2_HEADER_LEN, mb2_header_end - mb2_header_start
.set MB2_CHECKSUM, -(MB2_MAGIC + MB2_ARCH + MB2_HEADER_LEN)
.section .multiboot
.balign 8
mb2_header_start:
.long MB2_MAGIC
.long MB2_ARCH
.long MB2_HEADER_LEN
.long MB2_CHECKSUM
.short 0
.short 0
.long 8
mb2_header_end:
.section .bss
.balign 16
stack_bottom:
.skip 16384
stack_top:
.section .text
.global _start
.type _start, @function
.extern kernel_main
_start:
    cli
    cld
    mov $stack_top, %esp
    and $-16, %esp
    xor %ebp, %ebp
    /* cdecl: kernel_main(magic, info_ptr) */
    push %ebx
    push %eax
    call kernel_main
1:  cli
    hlt
    jmp 1b
