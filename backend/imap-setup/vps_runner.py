import sys
import pexpect

def run_vps(cmd):
    child = pexpect.spawn(f'ssh -o StrictHostKeyChecking=no root@187.52.117.2', timeout=60)
    child.expect("password:")
    child.sendline("Hasanameer386@gmail.com")
    child.expect("#")
    child.sendline(cmd)
    child.expect("#")
    print(child.before.decode())
    child.sendline("exit")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_vps(sys.argv[1])
    else:
        print("Usage: python3 vps_runner.py '<command>'")
