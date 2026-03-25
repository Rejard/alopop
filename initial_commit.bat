@echo off
"C:\Program Files\Git\cmd\git.exe" init
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" config user.email "lemai@example.com"
"C:\Program Files\Git\cmd\git.exe" config user.name "lemai"
"C:\Program Files\Git\cmd\git.exe" commit -m "Phase 10: Complete alopop with profile customization"
"C:\Program Files\Git\cmd\git.exe" branch -M main
"C:\Program Files\Git\cmd\git.exe" remote add origin git@github.com:Rejard/alopop.git
"C:\Program Files\Git\cmd\git.exe" push -u origin main
