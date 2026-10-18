#include <stdint.h>
#include <stddef.h>

/* ── Multiboot2 ─────────────────────────────────────────────────────────── */
#define MB2_BOOT_MAGIC 0x36D76289u

/* ── Freestanding string helpers (no libc) ──────────────────────────────── */
static int xmemcmp(const void *a, const void *b, unsigned n) {
    const unsigned char *pa = (const unsigned char *)a;
    const unsigned char *pb = (const unsigned char *)b;
    for (unsigned i = 0; i < n; i++) {
        if (pa[i] != pb[i]) return (int)pa[i] - (int)pb[i];
    }
    return 0;
}

/* ── VGA text-mode helpers ──────────────────────────────────────────────── */
#define VGA_COLS 80
#define VGA_ROWS 25
#define VGA ((volatile uint16_t*)0xB8000)
#define ATTR(bg,fg) ((uint8_t)(((bg)<<4)|(fg)))

/* colour palette shortcuts */
#define C_NORMAL   ATTR(0,7)
#define C_BRIGHT   ATTR(0,15)
#define C_TITLE    ATTR(1,15)   /* blue bg, white fg  */
#define C_HILIGHT  ATTR(0,11)   /* cyan               */
#define C_GREEN    ATTR(0,10)
#define C_RED      ATTR(0,12)
#define C_YELLOW   ATTR(0,14)
#define C_SELECTED ATTR(2,15)   /* green bg           */
#define C_BUTTON   ATTR(3,0)    /* cyan bg, black     */
#define C_BTSEL    ATTR(6,15)   /* brown bg, white    */
#define C_BORDER   ATTR(1,14)   /* blue bg, yellow    */
#define C_INVERT   ATTR(7,0)    /* white bg, black    */

static uint8_t  cur_color = C_NORMAL;
static unsigned cur_row, cur_col;

static void put_at(unsigned x, unsigned y, char c, uint8_t attr) {
    if (x < VGA_COLS && y < VGA_ROWS)
        VGA[y*VGA_COLS+x] = ((uint16_t)attr<<8)|(uint8_t)c;
}
static void cls(uint8_t attr) {
    for (unsigned i = 0; i < VGA_COLS*VGA_ROWS; ++i)
        VGA[i] = ((uint16_t)attr<<8)|' ';
    cur_row = cur_col = 0;
}
static void scroll(void) {
    for (unsigned y = 1; y < VGA_ROWS; ++y)
        for (unsigned x = 0; x < VGA_COLS; ++x)
            VGA[(y-1)*VGA_COLS+x] = VGA[y*VGA_COLS+x];
    for (unsigned x = 0; x < VGA_COLS; ++x) put_at(x, VGA_ROWS-1, ' ', cur_color);
    cur_row = VGA_ROWS-1;
}
static void putc(char c) {
    if (c=='\n') { cur_col=0; if (++cur_row>=VGA_ROWS) scroll(); return; }
    if (c=='\r') { cur_col=0; return; }
    if (c=='\b') { if (cur_col) { --cur_col; put_at(cur_col,cur_row,' ',cur_color); } return; }
    put_at(cur_col,cur_row,c,cur_color);
    if (++cur_col>=VGA_COLS) { cur_col=0; if (++cur_row>=VGA_ROWS) scroll(); }
}
static void puts(const char *s) { while (*s) putc(*s++); }

/* draw a horizontal line of 'ch' at (x,y) length len with attr */
static void hline(unsigned x, unsigned y, char ch, unsigned len, uint8_t attr) {
    for (unsigned i=0;i<len;++i) put_at(x+i,y,ch,attr);
}
/* draw vertical line */
static void vline(unsigned x, unsigned y, char ch, unsigned len, uint8_t attr) {
    for (unsigned i=0;i<len;++i) put_at(x,y+i,ch,attr);
}
/* fill rect */
static void fill_rect(unsigned x,unsigned y,unsigned w,unsigned h,char ch,uint8_t attr){
    for (unsigned row=0;row<h;++row)
        hline(x,y+row,ch,w,attr);
}
/* draw box with single-line border */
static void draw_box(unsigned x,unsigned y,unsigned w,unsigned h,uint8_t attr){
    put_at(x,y,0xDA,attr); put_at(x+w-1,y,0xBF,attr);
    put_at(x,y+h-1,0xC0,attr); put_at(x+w-1,y+h-1,0xD9,attr);
    hline(x+1,y,0xC4,w-2,attr); hline(x+1,y+h-1,0xC4,w-2,attr);
    vline(x,y+1,0xB3,h-2,attr); vline(x+w-1,y+1,0xB3,h-2,attr);
    fill_rect(x+1,y+1,w-2,h-2,' ',attr);
}
/* print string at specific position */
static void print_at(unsigned x,unsigned y,const char *s,uint8_t attr){
    while(*s && x<VGA_COLS) { put_at(x++,y,*s++,attr); }
}
/* center string in a field of width w starting at (x,y) */
static void print_center(unsigned x,unsigned y,unsigned w,const char *s,uint8_t attr){
    unsigned len=0; const char*p=s; while(*p++){len++;}
    unsigned pad=(len<w)?(w-len)/2:0;
    for(unsigned i=0;i<w;i++){
        char c=' ';
        if(i>=pad && i<pad+len) c=s[i-pad];
        put_at(x+i,y,c,attr);
    }
}

/* ── strlen / itoa helpers ──────────────────────────────────────────────── */
static unsigned xstrlen(const char*s){unsigned n=0;while(s[n])n++;return n;}
static void utoa(unsigned v,char*buf,unsigned base){
    if(!v){buf[0]='0';buf[1]=0;return;}
    char tmp[12]; int i=0;
    while(v){tmp[i++]="0123456789ABCDEF"[v%base];v/=base;}
    int j=0; while(i>0) buf[j++]=tmp[--i]; buf[j]=0;
}

/* ── PS/2 keyboard ──────────────────────────────────────────────────────── */
static uint8_t inb(uint16_t port){
    uint8_t v; __asm__ volatile("inb %1,%0":"=a"(v):"Nd"(port)); return v;
}
static char key_char(uint8_t s){
    static const char lower[128]={
        [2]='1',[3]='2',[4]='3',[5]='4',[6]='5',[7]='6',[8]='7',[9]='8',[10]='9',[11]='0',
        [12]='-',[13]='=',[14]='\b',
        [16]='q',[17]='w',[18]='e',[19]='r',[20]='t',[21]='y',[22]='u',[23]='i',[24]='o',[25]='p',
        [26]='[',[27]=']',[28]='\n',
        [30]='a',[31]='s',[32]='d',[33]='f',[34]='g',[35]='h',[36]='j',[37]='k',[38]='l',
        [39]=';',[40]='\'',[41]='`',[43]='\\',[44]='z',[45]='x',[46]='c',[47]='v',
        [48]='b',[49]='n',[50]='m',[51]=',',[52]='.',[53]='/',[57]=' '
    };
    return s<128?lower[s]:0;
}
/* scancode constants */
#define SC_ESC   0x01
#define SC_ENTER 0x1C
#define SC_UP    0x48
#define SC_DOWN  0x50
#define SC_LEFT  0x4B
#define SC_RIGHT 0x4D
#define SC_F1    0x3B
#define SC_F2    0x3C
#define SC_F3    0x3D
#define SC_F5    0x3F
#define SC_TAB   0x0F

static uint8_t last_sc = 0;
static uint8_t read_scancode(void){
    if(!(inb(0x64)&1)) return 0;
    uint8_t s=inb(0x60);
    if(s==0xE0){ /* extended – swallow prefix, read next */ 
        while(!(inb(0x64)&1)){}
        uint8_t s2=inb(0x60);
        /* map extended arrows */
        if(s2==0x48) return SC_UP;
        if(s2==0x50) return SC_DOWN;
        if(s2==0x4B) return SC_LEFT;
        if(s2==0x4D) return SC_RIGHT;
        return 0;
    }
    return s;
}

/* ── State machine ──────────────────────────────────────────────────────── */
typedef enum {
    PAGE_DESKTOP=0,
    PAGE_TERMINAL,
    PAGE_SYSINFO,
    PAGE_ABOUT,
    PAGE_INSTALLER,
    PAGE_INSTALL_CONFIRM,
    PAGE_INSTALL_PROGRESS,
    PAGE_INSTALL_DONE,
    PAGE_SETTINGS,
    PAGE_FILES,
} Page;

static Page current_page = PAGE_DESKTOP;
static int  desktop_sel  = 0;   /* selected desktop icon 0-4 */

/* ── Taskbar ────────────────────────────────────────────────────────────── */
static void draw_taskbar(void){
    /* bottom row = VGA_ROWS-1 = row 24 */
    fill_rect(0,24,80,1,' ',ATTR(1,15));
    print_at(0,24," MiniOS 0.9 ",ATTR(1,11));
    print_at(12,24,"|",ATTR(1,7));
    print_at(13,24," [F1] Desktop  [F2] Terminal  [F3] SysInfo  [F5] Installer ",ATTR(1,15));
    /* clock placeholder right-aligned */
    print_at(72,24,"[ESC=Back]",ATTR(1,14));
}

/* ── Title bar helper ───────────────────────────────────────────────────── */
static void draw_titlebar(const char *title){
    fill_rect(0,0,80,1,' ',C_TITLE);
    print_center(0,0,80,title,C_TITLE);
}

/* ══════════════════════════════════════════════════════════════════════════
   DESKTOP
   ══════════════════════════════════════════════════════════════════════════ */
/* Icon box width=13, gap=1 => 5*(13+1)-1 = 69 cols, start at x=5 => ends at 74. Fits in 80. */
#define ICON_W  13
#define ICON_GAP 2
#define ICON_START 3
typedef struct { const char *icon; const char *label; Page target; } DesktopIcon;
static const DesktopIcon icons[] = {
    {"\x01", "Terminal",  PAGE_TERMINAL},
    {"\x02", "Sys Info",  PAGE_SYSINFO},
    {"\x03", "Files",     PAGE_FILES},
    {"\x04", "Settings",  PAGE_SETTINGS},
    {"\x05", "Install",   PAGE_INSTALLER},
};
#define NUM_ICONS 5

static void draw_desktop(void){
    cls(ATTR(1,7));
    draw_titlebar("  MiniOS 0.9  -  Graphical Desktop  ");
    /* wallpaper dots */
    for(unsigned y=2;y<23;y+=2)
        for(unsigned x=2;x<78;x+=4)
            put_at(x,y,'.',ATTR(1,8));
    /* icons: evenly spaced across screen */
    for(int i=0;i<NUM_ICONS;i++){
        unsigned ix = ICON_START + i*(ICON_W+ICON_GAP);
        uint8_t attr = (i==desktop_sel) ? C_SELECTED : ATTR(1,15);
        uint8_t lattr= (i==desktop_sel) ? C_SELECTED : ATTR(1,11);
        draw_box(ix,4,ICON_W,4,attr);
        print_center(ix+1,5,ICON_W-2,icons[i].icon,attr);
        print_center(ix+1,6,ICON_W-2,icons[i].label,lattr);
    }
    /* hint */
    print_at(5,20,"  Arrow keys: select   ENTER: open   F1-F5: shortcuts   ESC: back",C_NORMAL);
    draw_taskbar();
    cur_row=23; cur_col=0;
}

/* ══════════════════════════════════════════════════════════════════════════
   TERMINAL
   ══════════════════════════════════════════════════════════════════════════ */
#define TERM_ROWS 20
#define TERM_COLS 76
static char term_buf[TERM_ROWS][TERM_COLS+1];
static int  term_row=0;
static char input_buf[128];
static unsigned input_len=0;

static void term_scroll(void){
    for(int r=0;r<TERM_ROWS-1;r++)
        for(int c=0;c<TERM_COLS;c++)
            term_buf[r][c]=term_buf[r+1][c];
    for(int c=0;c<TERM_COLS;c++) term_buf[TERM_ROWS-1][c]=' ';
    term_buf[TERM_ROWS-1][TERM_COLS]=0;
    if(term_row>0) term_row--;
}

static void term_puts_row(const char*s){
    if(term_row>=TERM_ROWS) term_scroll();
    int c=0;
    while(*s && c<TERM_COLS) term_buf[term_row][c++]=*s++;
    while(c<=TERM_COLS) term_buf[term_row][c++]=' ';
    term_buf[term_row][TERM_COLS]=0;
    term_row++;
}
static void term_blank_row(void){
    if(term_row>=TERM_ROWS) term_scroll();
    for(int c=0;c<=TERM_COLS;c++) term_buf[term_row][c]=' ';
    term_buf[term_row][TERM_COLS]=0;
    term_row++;
}

static void render_terminal(void){
    /* background */
    fill_rect(0,1,80,23,ATTR(0,10),' ');
    fill_rect(2,1,76,TERM_ROWS,ATTR(0,2),' ');
    draw_titlebar("  MiniOS 0.9  -  Terminal  ");
    for(int r=0;r<TERM_ROWS;r++)
        print_at(2,1+r,term_buf[r],ATTR(0,10));
    /* input line */
    fill_rect(0,22,80,1,' ',ATTR(0,2));
    print_at(0,22," minios> ",ATTR(0,11));
    print_at(9,22,input_buf,ATTR(0,15));
    put_at(9+input_len,22,'_',ATTR(0,15));
    draw_taskbar();
}

static void term_cmd(void){
    input_buf[input_len]=0;
    /* echo */
    char echo[128];
    unsigned ei=0;
    const char *pfx="$ ";
    while(pfx[ei]){ echo[ei]=pfx[ei]; ei++; }
    unsigned j=0; while(input_buf[j]&&ei<127) echo[ei++]=input_buf[j++];
    echo[ei]=0;
    term_puts_row(echo);

    if(input_len==0){ term_blank_row(); goto done; }

    /* compare helper */
    #define CMD(s) (input_len==sizeof(s)-1 && \
        xmemcmp(input_buf,s,sizeof(s)-1)==0)

    if(CMD("help")){
        term_puts_row("Commands: help  clear  ver  uname  mem  echo <text>  reboot  install");
    } else if(CMD("clear")){
        term_row=0;
        for(int r=0;r<TERM_ROWS;r++){
            for(int c=0;c<TERM_COLS;c++) term_buf[r][c]=' ';
            term_buf[r][TERM_COLS]=0;
        }
        input_len=0; input_buf[0]=0;
        render_terminal();
        return;
    } else if(CMD("ver")){
        term_puts_row("MiniOS 0.9 / kernel build 2026-10-18 / Multiboot2 / i386");
    } else if(CMD("uname")){
        term_puts_row("MiniOS 0.9 i386 freestanding #1");
    } else if(CMD("mem")){
        term_puts_row("Detected: conventional 640 KB + extended (Multiboot2 map pending)");
    } else if(CMD("reboot")){
        term_puts_row("Rebooting...");
        render_terminal();
        /* pulse 8042 reset line */
        while(inb(0x64)&2){}
        __asm__ volatile("outb %0,%1"::"a"((uint8_t)0xFE),"Nd"((uint16_t)0x64));
        for(;;) __asm__ volatile("hlt");
    } else if(CMD("install")){
        input_len=0; input_buf[0]=0;
        current_page=PAGE_INSTALLER;
        return;
    } else if(input_len>=5 && input_buf[0]=='e'&&input_buf[1]=='c'&&
              input_buf[2]=='h'&&input_buf[3]=='o'&&input_buf[4]==' '){
        term_puts_row(input_buf+5);
    } else {
        char ebuf[80];
        unsigned ei2=0;
        const char *ep="Unknown command: ";
        while(ep[ei2]&&ei2<79){ ebuf[ei2]=ep[ei2]; ei2++; }
        unsigned k=0; while(input_buf[k]&&ei2<79) ebuf[ei2++]=input_buf[k++];
        ebuf[ei2]=0;
        term_puts_row(ebuf);
    }
    term_blank_row();
done:
    input_len=0; input_buf[0]=0;
    render_terminal();
}

static void init_terminal(void){
    term_row=0;
    for(int r=0;r<TERM_ROWS;r++){
        for(int c=0;c<=TERM_COLS;c++) term_buf[r][c]=' ';
        term_buf[r][TERM_COLS]=0;
    }
    term_puts_row("MiniOS 0.9 Terminal - type 'help' for commands");
    term_blank_row();
    input_len=0; input_buf[0]=0;
}

/* ══════════════════════════════════════════════════════════════════════════
   SYSTEM INFO
   ══════════════════════════════════════════════════════════════════════════ */
static void draw_sysinfo(void){
    cls(ATTR(0,7));
    draw_titlebar("  MiniOS 0.9  -  System Information  ");
    draw_box(2,2,36,18,ATTR(1,14));
    print_center(2,2,36,"[ Hardware ]",ATTR(1,14));
    const char *hw[][2]={
        {"Architecture","x86 32-bit protected"},
        {"Boot protocol","Multiboot2"},
        {"Display      ","VGA text 80x25"},
        {"Keyboard     ","PS/2 polling"},
        {"Framebuffer  ","not required"},
        {"Disk / USB   ","not implemented"},
        {"Network      ","not implemented"},
        {"FPU          ","present (not enabled)"},
        {"Paging       ","disabled"},
    };
    for(int i=0;i<9;i++){
        print_at(4,4+i,hw[i][0],ATTR(1,11));
        print_at(17,4+i,":",ATTR(1,7));
        print_at(19,4+i,hw[i][1],ATTR(1,15));
    }
    draw_box(40,2,38,18,ATTR(2,14));
    print_center(40,2,38,"[ Software ]",ATTR(2,14));
    const char *sw[][2]={
        {"OS Name  ","MiniOS 0.9"},
        {"Build    ","2026-10-18"},
        {"Compiler ","Clang 21 (LLVM)"},
        {"Linker   ","ld.lld"},
        {"Bootloader","Limine v9.2.3"},
        {"Shell    ","Built-in VGA shell"},
        {"Installer","Graphical (this build)"},
        {"Licence  ","MIT / open source"},
    };
    for(int i=0;i<8;i++){
        print_at(42,4+i,sw[i][0],ATTR(2,11));
        print_at(52,4+i,":",ATTR(2,7));
        print_at(54,4+i,sw[i][1],ATTR(2,15));
    }
    print_at(4,21,"  Press ESC or F1 to return to desktop",C_NORMAL);
    draw_taskbar();
}

/* ══════════════════════════════════════════════════════════════════════════
   FILES (simple viewer)
   ══════════════════════════════════════════════════════════════════════════ */
static void draw_files(void){
    cls(ATTR(0,7));
    draw_titlebar("  MiniOS 0.9  -  File Browser  ");
    draw_box(1,1,78,21,C_BORDER);
    print_center(1,1,78,"[ / (root) ]",C_BORDER);
    const char *entries[]={
        "drwxr-xr-x  boot/",
        "drwxr-xr-x  dev/",
        "drwxr-xr-x  proc/",
        "drwxr-xr-x  sys/",
        "-rw-r--r--  kernel.elf       (this kernel)",
        "-rw-r--r--  limine.conf",
    };
    for(int i=0;i<6;i++)
        print_at(4,3+i,entries[i],(i%2)?ATTR(0,15):ATTR(0,11));
    print_at(4,11,"(Disk driver not yet implemented - virtual listing only)",C_NORMAL);
    print_at(4,20,"  ESC = back",C_NORMAL);
    draw_taskbar();
}

/* ══════════════════════════════════════════════════════════════════════════
   SETTINGS
   ══════════════════════════════════════════════════════════════════════════ */
static int settings_sel=0;
static const char *settings_items[]={
    "Display: VGA text 80x25 (fixed)",
    "Keyboard: PS/2 polling (fixed)",
    "Language: English",
    "Reboot system",
    "Halt system",
};
#define NUM_SETTINGS 5
static void draw_settings(void){
    cls(ATTR(0,7));
    draw_titlebar("  MiniOS 0.9  -  Settings  ");
    draw_box(15,2,50,16,C_BORDER);
    print_center(15,2,50,"[ System Settings ]",C_BORDER);
    for(int i=0;i<NUM_SETTINGS;i++){
        uint8_t a=(i==settings_sel)?C_SELECTED:ATTR(0,15);
        print_center(16,4+i*2,48,settings_items[i],a);
    }
    print_at(18,20,"  UP/DOWN to navigate, ENTER to activate, ESC = back",C_NORMAL);
    draw_taskbar();
}
static void settings_activate(void){
    if(settings_sel==3){ /* reboot */
        while(inb(0x64)&2){}
        __asm__ volatile("outb %0,%1"::"a"((uint8_t)0xFE),"Nd"((uint16_t)0x64));
        for(;;) __asm__ volatile("hlt");
    }
    if(settings_sel==4){ /* halt */
        for(;;) __asm__ volatile("cli; hlt");
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   INSTALLER  (graphical wizard, 4 steps)
   ══════════════════════════════════════════════════════════════════════════ */
#define INS_STEPS 4
static int ins_step=0;    /* 0=welcome 1=disk 2=confirm 3=progress/done */
static int ins_disk_sel=0;
static int ins_progress=0;

static const char *disk_names[]={"(hd0) Virtual Disk 0   ~20 GB","(hd1) Virtual Disk 1   ~10 GB","(hd2) USB Drive        ~4 GB"};
#define NUM_DISKS 3

static void draw_installer_progress_bar(unsigned y, unsigned pct, unsigned w, uint8_t full, uint8_t empty){
    unsigned filled = pct*w/100;
    for(unsigned i=0;i<w;i++)
        put_at(10+i,y,i<filled?'\xDB':'\xB0',i<filled?full:empty);
    /* percentage */
    char buf[8]; utoa(pct,buf,10);
    unsigned blen=xstrlen(buf);
    print_at(10+w+1,y,buf,C_BRIGHT);
    print_at(10+w+1+blen,y,"%  ",C_BRIGHT);
}

static void draw_installer_step_indicator(void){
    const char*labels[]={"Welcome","Disk","Confirm","Install"};
    for(int i=0;i<INS_STEPS;i++){
        unsigned x=4+i*18;
        uint8_t a=(i==ins_step)?C_BTSEL:ATTR(1,8);
        char num[4]; num[0]=' '; num[1]='0'+i+1; num[2]='.'; num[3]=0;
        char full[20]; unsigned fi=0;
        const char *src=num; while(*src) full[fi++]=*src++;
        src=labels[i]; while(*src) full[fi++]=*src++;
        full[fi]=0;
        print_center(x,2,14,full,a);
    }
}

static void draw_installer(void){
    cls(ATTR(1,7));
    draw_titlebar("  MiniOS 0.9  -  System Installer  ");
    draw_installer_step_indicator();
    draw_box(2,3,76,18,C_BORDER);

    if(ins_step==0){
        /* Welcome */
        print_center(2,3,76,"[ Welcome to MiniOS Installer ]",C_BORDER);
        print_at(8,6, "Welcome to the MiniOS 0.9 graphical installer.",C_BRIGHT);
        print_at(8,8, "This wizard will guide you through installing MiniOS to a disk.",C_NORMAL);
        print_at(8,9, "Please read each step carefully before proceeding.",C_NORMAL);
        print_at(8,11,"  * MiniOS requires at least 512 MB of disk space.",C_YELLOW);
        print_at(8,12,"  * All data on the target disk will be erased.",C_RED);
        print_at(8,13,"  * Only use a spare disk or virtual machine disk.",C_RED);
        print_at(8,15,"  NOTE: This is an experimental build. Disk write is not",C_YELLOW);
        print_at(8,16,"        implemented in this VGA kernel — the installer is a",C_YELLOW);
        print_at(8,17,"        UI prototype. Real installation requires a Linux live OS.",C_YELLOW);
        /* buttons */
        print_at(20,19,"[ NEXT > ]",C_BUTTON);
        print_at(48,19,"[ CANCEL ]",C_BTSEL);
        print_at(8,20,"  ENTER = Next   ESC = Cancel",C_NORMAL);
    } else if(ins_step==1){
        /* Disk select */
        print_center(2,3,76,"[ Select Installation Target ]",C_BORDER);
        print_at(6,5,"Choose the disk to install MiniOS on:",C_BRIGHT);
        print_at(6,6,"WARNING: ALL DATA ON THIS DISK WILL BE ERASED!",C_RED);
        for(int i=0;i<NUM_DISKS;i++){
            uint8_t a=(i==ins_disk_sel)?C_SELECTED:ATTR(1,15);
            char row[80]; unsigned ri=0;
            row[ri++]=' '; row[ri++]=(i==ins_disk_sel)?'>':' ';
            row[ri++]=' ';
            const char*dn=disk_names[i];
            while(*dn&&ri<78) row[ri++]=*dn++;
            row[ri]=0;
            print_at(6,8+i*2,row,a);
        }
        print_at(6,15,"Use UP/DOWN to select disk",C_NORMAL);
        print_at(20,18,"[ < BACK ]",C_BUTTON);
        print_at(35,18,"[ NEXT > ]",C_BUTTON);
        print_at(6,20,"  ENTER = Confirm selection   B = Back   ESC = Cancel",C_NORMAL);
    } else if(ins_step==2){
        /* Confirm */
        print_center(2,3,76,"[ Confirm Installation ]",C_BORDER);
        print_at(8,5,"Please confirm your installation settings:",C_BRIGHT);
        print_at(8,7,"  Target disk :",C_NORMAL);
        print_at(24,7,disk_names[ins_disk_sel],C_YELLOW);
        print_at(8,8,"  OS          : MiniOS 0.9",C_NORMAL);
        print_at(8,9,"  Bootloader  : Limine (BIOS)",C_NORMAL);
        print_at(8,10,"  Filesystem  : ext2 (planned)",C_NORMAL);
        print_at(8,12,"  !! All data on the selected disk will be permanently erased !!",C_RED);
        print_at(8,13,"  Are you absolutely sure?",C_RED);
        print_at(8,16,"Type YES to confirm: ",C_BRIGHT);
        print_at(29,16,input_buf,C_YELLOW);
        put_at(29+input_len,16,'_',C_YELLOW);
        print_at(8,19,"  Type YES and press ENTER to install.  ESC = cancel.",C_NORMAL);
    } else if(ins_step==3){
        /* Progress / done */
        if(ins_progress<100){
            print_center(2,3,76,"[ Installing MiniOS... ]",C_BORDER);
            print_at(6,6,"Installation in progress. Please wait...",C_BRIGHT);
            const char *stages[]={
                "Partitioning disk       ",
                "Formatting filesystem   ",
                "Copying kernel files    ",
                "Installing bootloader   ",
                "Writing configuration   ",
            };
            for(int i=0;i<5;i++){
                uint8_t a=(ins_progress>i*20)?C_GREEN:C_NORMAL;
                print_at(6,8+i,stages[i],a);
                print_at(30,8+i,(ins_progress>i*20)?"[DONE]":"[    ]",a);
            }
            draw_installer_progress_bar(15,ins_progress,50,ATTR(0,10),ATTR(0,8));
        } else {
            print_center(2,3,76,"[ Installation Complete! ]",C_BORDER);
            print_at(8,6,"MiniOS 0.9 has been installed successfully.",C_GREEN);
            print_at(8,8,"  * Remove the installation media",C_NORMAL);
            print_at(8,9,"  * Press ENTER or R to reboot",C_NORMAL);
            print_at(8,10,"  * The system will boot from the installed disk",C_NORMAL);
            print_at(8,13,"  (Simulated: no actual disk writes were performed in this build)",C_YELLOW);
            print_at(20,17,"[ REBOOT NOW ]",C_BUTTON);
            print_at(40,17,"[ RETURN TO DESKTOP ]",C_BTSEL);
        }
    }
    draw_taskbar();
}

/* simulate progress: call repeatedly */
static void installer_tick(void){
    if(ins_step==3 && ins_progress<100){
        /* burn a bit of time */
        for(volatile unsigned i=0;i<5000000;i++) __asm__ volatile("pause");
        ins_progress+=2; if(ins_progress>100) ins_progress=100;
        draw_installer();
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   INPUT DISPATCH
   ══════════════════════════════════════════════════════════════════════════ */
static void handle_input(uint8_t sc){
    char c = key_char(sc & 0x7F);
    int pressed = !(sc & 0x80);
    if(!pressed) return;   /* ignore key-up */

    /* F-keys work from anywhere */
    if(sc==SC_F1){ current_page=PAGE_DESKTOP; draw_desktop(); return; }
    if(sc==SC_F2){ current_page=PAGE_TERMINAL; init_terminal(); render_terminal(); return; }
    if(sc==SC_F3){ current_page=PAGE_SYSINFO;  draw_sysinfo();  return; }
    if(sc==SC_F5){ current_page=PAGE_INSTALLER; ins_step=0; draw_installer(); return; }

    switch(current_page){
    /* ── Desktop ── */
    case PAGE_DESKTOP:
        if(sc==SC_LEFT||sc==SC_UP){desktop_sel=(desktop_sel+NUM_ICONS-1)%NUM_ICONS;draw_desktop();}
        else if(sc==SC_RIGHT||sc==SC_DOWN){desktop_sel=(desktop_sel+1)%NUM_ICONS;draw_desktop();}
        else if(sc==SC_ENTER||c=='\n'){
            current_page=icons[desktop_sel].target;
            switch(current_page){
                case PAGE_TERMINAL: init_terminal(); render_terminal(); break;
                case PAGE_SYSINFO:  draw_sysinfo(); break;
                case PAGE_FILES:    draw_files(); break;
                case PAGE_SETTINGS: settings_sel=0; draw_settings(); break;
                case PAGE_INSTALLER:ins_step=0; ins_progress=0; input_len=0; input_buf[0]=0; draw_installer(); break;
                default: draw_desktop(); break;
            }
        }
        break;
    /* ── Terminal ── */
    case PAGE_TERMINAL:
        if(sc==SC_ESC){ current_page=PAGE_DESKTOP; draw_desktop(); }
        else if(c=='\b'){ if(input_len){--input_len;input_buf[input_len]=0;} render_terminal(); }
        else if(c=='\n'){ term_cmd(); }
        else if(c>=32&&c<127&&input_len<120){ input_buf[input_len++]=c; input_buf[input_len]=0; render_terminal(); }
        break;
    /* ── Sys info ── */
    case PAGE_SYSINFO:
        if(sc==SC_ESC||sc==SC_F1){ current_page=PAGE_DESKTOP; draw_desktop(); }
        break;
    /* ── Files ── */
    case PAGE_FILES:
        if(sc==SC_ESC){ current_page=PAGE_DESKTOP; draw_desktop(); }
        break;
    /* ── Settings ── */
    case PAGE_SETTINGS:
        if(sc==SC_ESC){ current_page=PAGE_DESKTOP; draw_desktop(); }
        else if(sc==SC_UP){settings_sel=(settings_sel+NUM_SETTINGS-1)%NUM_SETTINGS;draw_settings();}
        else if(sc==SC_DOWN){settings_sel=(settings_sel+1)%NUM_SETTINGS;draw_settings();}
        else if(c=='\n'){ settings_activate(); draw_settings(); }
        break;
    /* ── Installer ── */
    case PAGE_INSTALLER:
        if(ins_step==0){
            if(c=='\n'){ins_step=1;draw_installer();}
            else if(sc==SC_ESC){current_page=PAGE_DESKTOP;draw_desktop();}
        } else if(ins_step==1){
            if(sc==SC_UP){ins_disk_sel=(ins_disk_sel+NUM_DISKS-1)%NUM_DISKS;draw_installer();}
            else if(sc==SC_DOWN){ins_disk_sel=(ins_disk_sel+1)%NUM_DISKS;draw_installer();}
            else if(c=='\n'){ins_step=2;input_len=0;input_buf[0]=0;draw_installer();}
            else if(c=='b'||c=='B'){ins_step=0;draw_installer();}
            else if(sc==SC_ESC){current_page=PAGE_DESKTOP;draw_desktop();}
        } else if(ins_step==2){
            if(sc==SC_ESC){current_page=PAGE_DESKTOP;draw_desktop();}
            else if(c=='\b'){if(input_len){--input_len;input_buf[input_len]=0;}draw_installer();}
            else if(c=='\n'){
                /* check YES */
                if(input_len==3&&input_buf[0]=='Y'&&input_buf[1]=='E'&&input_buf[2]=='S'){
                    ins_step=3; ins_progress=0; draw_installer();
                } else {
                    input_len=0; input_buf[0]=0; draw_installer();
                }
            } else if(c>='A'&&c<='Z'&&input_len<6){ input_buf[input_len++]=c; input_buf[input_len]=0; draw_installer(); }
            else if(c>='a'&&c<='z'&&input_len<6){ input_buf[input_len++]=c-32; input_buf[input_len]=0; draw_installer(); }
        } else if(ins_step==3){
            if(ins_progress>=100){
                if(c=='\n'||c=='r'||c=='R'){
                    while(inb(0x64)&2){}
                    __asm__ volatile("outb %0,%1"::"a"((uint8_t)0xFE),"Nd"((uint16_t)0x64));
                    for(;;) __asm__ volatile("hlt");
                }
                if(sc==SC_ESC){current_page=PAGE_DESKTOP;draw_desktop();}
            }
        }
        break;
    default: break;
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   KERNEL MAIN
   ══════════════════════════════════════════════════════════════════════════ */
void kernel_main(uint32_t magic, uint32_t info_addr){
    (void)info_addr;
    if(magic != MB2_BOOT_MAGIC){
        cls(ATTR(4,15));
        puts("MiniOS BOOT ERROR: Multiboot2 magic mismatch.\r\n");
        puts("Expected 0x36D76289. Bootloader did not pass correct magic.\r\n");
        for(;;) __asm__ volatile("cli; hlt");
    }

    /* initial screen */
    current_page = PAGE_DESKTOP;
    desktop_sel  = 0;
    draw_desktop();

    for(;;){
        /* tick installer animation if active */
        if(current_page==PAGE_INSTALLER && ins_step==3 && ins_progress<100)
            installer_tick();

        uint8_t sc = read_scancode();
        if(!sc){ __asm__ volatile("pause"); continue; }
        if(sc == last_sc) continue;   /* basic debounce */
        last_sc = sc;
        handle_input(sc);
    }
}
