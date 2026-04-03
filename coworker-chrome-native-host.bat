@echo off
REM CoWorker Chrome Native Host
REM This batch file launches the native messaging host for CoWorker Chrome extension
setlocal

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

REM Launch Node.js with the native host module
node "%SCRIPT_DIR%dist\utils\claudeInChrome\chromeNativeHost.js" --coworker-chrome-native-host

endlocal
