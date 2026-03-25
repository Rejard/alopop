@echo off
"C:\Program Files\Git\cmd\git.exe" remote set-url origin git@github.com:Rejard/alopop.git
if not exist "%USERPROFILE%\.ssh\id_rsa" (
  ssh-keygen -t rsa -b 4096 -C "lemai@example.com" -f "%USERPROFILE%\.ssh\id_rsa" -N ""
)
echo --- Public Key Starts ---
type "%USERPROFILE%\.ssh\id_rsa.pub"
echo --- Public Key Ends ---
