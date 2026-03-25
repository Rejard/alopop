@echo off
set GIT_SSH_COMMAND=ssh -o StrictHostKeyChecking=no
"C:\Program Files\Git\cmd\git.exe" add README.md
"C:\Program Files\Git\cmd\git.exe" commit -m "docs: Update README.md with Korean installation guide"
"C:\Program Files\Git\cmd\git.exe" push origin main
