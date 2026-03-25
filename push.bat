@echo off
set GIT_SSH_COMMAND=ssh -o StrictHostKeyChecking=no
"C:\Program Files\Git\cmd\git.exe" push -u origin main
