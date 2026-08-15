import pexpect
import subprocess
import os

print("📦 Creating archive of updated project files...")
archive_cmd = [
    "tar", "-czf", "/tmp/email_project_update.tar.gz",
    "--exclude=node_modules",
    "--exclude=.next",
    "--exclude=.git",
    "--exclude=backend/storage/email_logs.sqlite*",
    "--exclude=backend/storage/live",
    "--exclude=backend/storage/local",
    "."
]
subprocess.run(archive_cmd, check=True)

print("🚀 Uploading archive to VPS (187.52.117.2)...")
child = pexpect.spawn("scp -o StrictHostKeyChecking=no /tmp/email_project_update.tar.gz root@187.52.117.2:/tmp/", timeout=60)
child.expect("password:")
child.sendline("Hasanameer386@gmail.com")
child.expect(pexpect.EOF)
print("✅ Archive uploaded successfully!")

print("📂 Extracting on VPS into /root/tempmail...")
child2 = pexpect.spawn("ssh -o StrictHostKeyChecking=no root@187.52.117.2 'cd /root/tempmail && tar -xzf /tmp/email_project_update.tar.gz && rm /tmp/email_project_update.tar.gz && echo EXTRACTED_OK'", timeout=60)
child2.expect("password:")
child2.sendline("Hasanameer386@gmail.com")
child2.expect(pexpect.EOF)
print(child2.before.decode())
print("🎉 Sync to VPS Completed!")
