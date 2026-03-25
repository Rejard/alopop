@echo off
"C:\Program Files\Git\cmd\git.exe" config user.email "lemaiii@hotmail.com"
"C:\Program Files\Git\cmd\git.exe" config user.name "Rejard"
if exist "%USERPROFILE%\.ssh\id_rsa" (
  del "%USERPROFILE%\.ssh\id_rsa"
)
if exist "%USERPROFILE%\.ssh\id_rsa.pub" (
  del "%USERPROFILE%\.ssh\id_rsa.pub"
)
ssh-keygen -t rsa -b 4096 -C "lemaiii@hotmail.com" -f "%USERPROFILE%\.ssh\id_rsa" -N ""
echo --- Public Key Starts ---
type "%USERPROFILE%\.ssh\id_rsa.pub"
echo --- Public Key Ends ---
