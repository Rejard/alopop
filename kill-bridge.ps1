Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*openclaw-bridge.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
