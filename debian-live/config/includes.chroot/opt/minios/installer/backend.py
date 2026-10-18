#!/usr/bin/env python3
"""MiniOS installer backend: serves the UI on 127.0.0.1 and performs a real install.
Must run as root. Usage: backend.py --port 8765   (env MINIOS_TOKEN = shared secret)
--dry-run prints/logs every command instead of executing (for testing the UI)."""
import os, sys, re, json, time, shutil, argparse, secrets, hmac, subprocess, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
LOGFILE = '/var/log/minios-installer.log'
TARGET = '/mnt/minios-target'
SRC_MNT = '/mnt/minios-src'
MIN_BYTES = 8 * 1024**3
S = {'state': 'idle', 'stage': '', 'percent': 0, 'error': None, 'log': []}
LOCK = threading.Lock()
DRY = False
TOKEN = os.environ.get('MINIOS_TOKEN') or secrets.token_hex(16)

def log(msg):
    line = time.strftime('%H:%M:%S ') + msg
    with LOCK:
        S['log'] = (S['log'] + [line])[-300:]
    try:
        with open(LOGFILE, 'a') as f: f.write(line + '\n')
    except OSError: pass

def stage(text, pct):
    with LOCK: S['stage'], S['percent'] = text, pct
    log('== ' + text)

def run(cmd, input=None, check=True, quiet=False):
    if not quiet: log('$ ' + ' '.join(cmd))
    if DRY: return ''
    p = subprocess.run(cmd, input=input, capture_output=True, text=True)
    if p.returncode and check:
        tail = (p.stderr or p.stdout or '').strip().splitlines()[-3:]
        raise RuntimeError(f"{cmd[0]}: {' '.join(tail) or 'код ' + str(p.returncode)}")
    return p.stdout

def out(cmd):
    try: return subprocess.run(cmd, capture_output=True, text=True).stdout
    except OSError: return ''

# ---------- disks ----------
def live_disks():
    bad = set()
    for mp in ('/run/live/medium', '/lib/live/mount/medium'):
        src = out(['findmnt', '-n', '-o', 'SOURCE', mp]).strip()
        if src.startswith('/dev/'):
            pk = out(['lsblk', '-no', 'PKNAME', src]).split()
            bad.add('/dev/' + (pk[0] if pk else os.path.basename(src)))
    return bad

def list_disks():
    raw = out(['lsblk', '-J', '-b', '-o', 'NAME,PATH,SIZE,MODEL,TRAN,TYPE,RO'])
    try: devs = json.loads(raw)['blockdevices']
    except Exception:
        if not DRY: return []
        devs = [{'path': '/dev/sdz', 'size': 32 * 1024**3, 'model': 'DRY-RUN DISK', 'type': 'disk', 'ro': False, 'name': 'sdz'}]
    bad, res = live_disks(), []
    for d in devs:
        if d.get('type') != 'disk' or d.get('ro') or re.match(r'(zram|ram|loop|sr|fd)', d.get('name', '')): continue
        size = int(d.get('size') or 0)
        res.append({'path': d['path'], 'size': size, 'model': (d.get('model') or '').strip() or 'Диск',
                    'tran': d.get('tran'), 'live': d['path'] in bad, 'small': size < MIN_BYTES})
    return res

def part(disk, n): return f'{disk}p{n}' if disk[-1].isdigit() else f'{disk}{n}'

# ---------- install ----------
def rsync_progress(src, dst):
    cmd = ['rsync', '-aHAXx', '--numeric-ids', '--no-inc-recursive', '--info=progress2', src + '/', dst + '/']
    log('$ ' + ' '.join(cmd))
    if DRY:
        for i in range(0, 101, 5):
            with LOCK: S['percent'] = 12 + i * 0.68
            time.sleep(.15)
        return
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    buf = b''
    while True:
        ch = p.stdout.read(256)
        if not ch: break
        buf = (buf + ch)[-512:]
        m = re.findall(rb'(\d+)%', buf)
        if m:
            with LOCK: S['percent'] = 12 + int(m[-1]) * 0.68
    if p.wait() not in (0, 23, 24): raise RuntimeError(f'rsync завершился с кодом {p.returncode}')

def find_source():
    for d in ('/run/live/rootfs/filesystem.squashfs', '/lib/live/mount/rootfs/filesystem.squashfs'):
        if os.path.isdir(d + '/etc'): return d, False
    for f in ('/run/live/medium/live/filesystem.squashfs', '/lib/live/mount/medium/live/filesystem.squashfs'):
        if os.path.isfile(f):
            os.makedirs(SRC_MNT, exist_ok=True)
            run(['mount', '-t', 'squashfs', '-o', 'ro,loop', f, SRC_MNT])
            return SRC_MNT, True
    if DRY: return '/', False
    raise RuntimeError('не найден образ системы (filesystem.squashfs). Запустите установщик из Live-сессии.')

def chroot(*a, **k): return run(['chroot', TARGET, *a], **k)

def cleanup():
    run(['sync'], check=False, quiet=True)
    if not DRY:
        if subprocess.run(['umount', '-R', TARGET], capture_output=True).returncode:
            subprocess.run(['umount', '-Rl', TARGET], capture_output=True)
        if os.path.ismount(SRC_MNT): subprocess.run(['umount', SRC_MNT], capture_output=True)

def install(c):
    disk, user, host = c['disk'], c['user'], c['host']
    efi_boot = os.path.isdir('/sys/firmware/efi')
    mounted_src = False
    try:
        if not DRY:
            for t in ('parted', 'mkfs.ext4', 'mkfs.vfat', 'rsync', 'grub-install', 'chroot', 'wipefs', 'blkid'):
                if not shutil.which(t): raise RuntimeError(f'в Live-системе нет программы {t}')
        stage('Разметка диска', 1)
        for line in out(['lsblk', '-nrpo', 'NAME,MOUNTPOINT', disk]).splitlines():
            f = line.split(None, 1)
            if len(f) == 2:
                run(['swapoff', f[0]] if f[1] == '[SWAP]' else ['umount', f[1]], check=False)
        for ch in out(['lsblk', '-nrpo', 'NAME', disk]).split()[1:]:
            run(['wipefs', '-a', ch], check=False)
        run(['wipefs', '-a', disk])
        run(['parted', '-s', disk, 'mklabel', 'gpt',
             'mkpart', 'biosboot', '1MiB', '3MiB', 'set', '1', 'bios_grub', 'on',
             'mkpart', 'EFI', 'fat32', '3MiB', '515MiB', 'set', '2', 'esp', 'on',
             'mkpart', 'MiniOS', 'ext4', '515MiB', '100%'])
        run(['partprobe', disk], check=False); run(['udevadm', 'settle'], check=False)
        p2, p3 = part(disk, 2), part(disk, 3)
        for _ in range(20):
            if DRY or (os.path.exists(p2) and os.path.exists(p3)): break
            time.sleep(.5)
        stage('Создание файловых систем', 8)
        run(['mkfs.vfat', '-F32', '-n', 'MINIOS_EFI', p2])
        run(['mkfs.ext4', '-F', '-q', '-L', 'MiniOS', p3])
        os.makedirs(TARGET, exist_ok=True)
        run(['mount', p3, TARGET]); os.makedirs(TARGET + '/boot/efi', exist_ok=True)
        run(['mount', p2, TARGET + '/boot/efi'])
        stage('Копирование системы', 12)
        src, mounted_src = find_source()
        rsync_progress(src, TARGET)
        stage('Настройка системы', 81)
        for d in ('dev', 'proc', 'sys', 'run', 'tmp', 'mnt', 'media'): os.makedirs(f'{TARGET}/{d}', exist_ok=True)
        for d in ('dev', 'proc', 'sys', 'run'):
            run(['mount', '--rbind', '/' + d, f'{TARGET}/{d}']); run(['mount', '--make-rslave', f'{TARGET}/{d}'], check=False)
        u3 = out(['blkid', '-s', 'UUID', '-o', 'value', p3]).strip() or 'DRY'
        u2 = out(['blkid', '-s', 'UUID', '-o', 'value', p2]).strip() or 'DRY'
        w = lambda path, txt: (None if DRY else open(TARGET + path, 'w').write(txt))
        os.makedirs(TARGET + '/etc/lightdm/lightdm.conf.d', exist_ok=True)
        w('/etc/fstab', f'UUID={u3} / ext4 errors=remount-ro 0 1\nUUID={u2} /boot/efi vfat umask=0077 0 2\n')
        w('/etc/hostname', host + '\n')
        w('/etc/hosts', f'127.0.0.1 localhost\n127.0.1.1 {host}\n::1 localhost ip6-localhost ip6-loopback\n')
        groups = set(l.split(':')[0] for l in open(TARGET + '/etc/group')) if not DRY else set()
        want = [g for g in ('sudo', 'audio', 'video', 'plugdev', 'netdev', 'cdrom', 'dialout') if g in groups]
        cmd = ['useradd', '-m', '-s', '/bin/bash', '-c', c['fullname']] + (['-G', ','.join(want)] if want else []) + [user]
        chroot(*cmd)
        run(['chroot', TARGET, 'chpasswd'], input=f"{user}:{c['password']}\n", quiet=True); log('$ chpasswd (пароль скрыт)')
        w('/etc/lightdm/lightdm.conf.d/50-minios.conf', f'[Seat:*]\nautologin-user={user}\nautologin-user-timeout=0\nautologin-session=xfce\n')
        stage('Установка загрузчика', 86)
        if not DRY:
            gp = TARGET + '/etc/default/grub'
            txt = open(gp).read() if os.path.exists(gp) else ''
            txt = re.sub(r'^GRUB_DISTRIBUTOR=.*\n?', '', txt, flags=re.M) + '\nGRUB_DISTRIBUTOR="MiniOS"\n'
            open(gp, 'w').write(txt)
        try: chroot('grub-install', '--target=i386-pc', '--recheck', disk)
        except RuntimeError as e:
            if not efi_boot: raise
            log('BIOS-загрузчик пропущен: ' + str(e))
        try: chroot('grub-install', '--target=x86_64-efi', '--efi-directory=/boot/efi', '--removable', '--recheck')
        except RuntimeError as e:
            if efi_boot: raise
            log('UEFI-загрузчик пропущен: ' + str(e))
        if efi_boot: chroot('grub-install', '--target=x86_64-efi', '--efi-directory=/boot/efi', '--bootloader-id=MiniOS', '--recheck', check=False)
        stage('Создание образа загрузки', 92)
        chroot('update-initramfs', '-u', '-k', 'all')
        chroot('update-grub')
        if not DRY and not os.path.exists(TARGET + '/boot/grub/grub.cfg'): raise RuntimeError('grub.cfg не создан')
        stage('Завершение', 98)
        cleanup()
        stage('Готово', 100)
        with LOCK: S['state'] = 'done'
    except Exception as e:
        log('ОШИБКА: ' + str(e))
        try: cleanup()
        except Exception: pass
        with LOCK: S['state'], S['error'] = 'error', str(e)

# ---------- http ----------
class H(BaseHTTPRequestHandler):
    server_version = 'MiniOSInstaller'
    def log_message(self, *a): pass
    def send(self, code, body, ctype='application/json'):
        b = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code); self.send_header('Content-Type', ctype + '; charset=utf-8')
        self.send_header('Content-Length', str(len(b))); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(b)
    def guard(self):
        if self.headers.get('Host', '') not in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'):
            self.send(403, {'error': 'bad host'}); return False
        if self.path.startswith('/api/') and not hmac.compare_digest(self.headers.get('X-Token', ''), TOKEN):
            self.send(403, {'error': 'bad token'}); return False
        return True
    def do_GET(self):
        if not self.guard(): return
        path = self.path.split('?')[0]
        if path in ('/', '/index.html'):
            return self.send(200, open(os.path.join(HERE, 'index.html'), 'rb').read(), 'text/html')
        if path == '/api/disks': return self.send(200, {'disks': list_disks(), 'efi': os.path.isdir('/sys/firmware/efi'), 'dry': DRY})
        if path == '/api/status':
            with LOCK: return self.send(200, {**S, 'log': S['log'][-30:]})
        self.send(404, {'error': 'not found'})
    def do_POST(self):
        if not self.guard(): return
        n = int(self.headers.get('Content-Length') or 0)
        try: d = json.loads(self.rfile.read(min(n, 65536)) or b'{}')
        except ValueError: return self.send(400, {'error': 'bad json'})
        if self.path == '/api/reboot':
            with LOCK: ok = S['state'] == 'done'
            if not ok: return self.send(409, {'error': 'установка не завершена'})
            if not DRY: threading.Timer(1, lambda: subprocess.run(['systemctl', 'reboot'])).start()
            return self.send(200, {'ok': True})
        if self.path != '/api/install': return self.send(404, {'error': 'not found'})
        disks = {x['path']: x for x in list_disks()}
        dk = disks.get(d.get('disk'))
        user, host, pw = str(d.get('user', '')), str(d.get('host', '')), str(d.get('password', ''))
        full = re.sub(r'[:,\n\r]', '', str(d.get('fullname', '')))[:60] or user
        err = (None if dk else 'диск не найден') or ('нельзя ставить на носитель установки' if dk['live'] else None) or \
              ('диск меньше 8 ГБ' if dk['small'] else None) or ('не подтверждено стирание' if d.get('confirm') != dk['path'] else None) or \
              (None if re.fullmatch(r'[a-z][a-z0-9_-]{0,30}', user) else 'некорректный логин') or \
              (None if re.fullmatch(r'[A-Za-z0-9]([A-Za-z0-9-]{0,30}[A-Za-z0-9])?', host) else 'некорректное имя компьютера') or \
              (None if len(pw) >= 4 and '\n' not in pw else 'слишком короткий пароль')
        if err: return self.send(400, {'error': err})
        with LOCK:
            if S['state'] == 'running': return self.send(409, {'error': 'установка уже идёт'})
            S.update(state='running', stage='', percent=0, error=None, log=[])
        threading.Thread(target=install, args=({'disk': dk['path'], 'user': user, 'host': host, 'password': pw, 'fullname': full},), daemon=True).start()
        self.send(200, {'ok': True})

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=8765); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(); DRY = a.dry_run
    if os.geteuid() != 0 and not DRY: sys.exit('Нужны права root')
    log(f'backend start, port {a.port}, dry={DRY}')
    ThreadingHTTPServer(('127.0.0.1', a.port), H).serve_forever()
