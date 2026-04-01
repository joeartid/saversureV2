@echo off
cd /d c:\saversureV2\backend
powershell -Command "Get-Content out.log -Tail 50 -Encoding Unicode" > c:\saversureV2\temp_log_output.txt 2>&1
echo DONE
