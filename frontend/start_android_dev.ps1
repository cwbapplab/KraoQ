
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot"
$env:ANDROID_HOME = ".\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = ".\AppData\Local\Android\Sdk"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-File", "$PSCommandPath"
    exit
}

Set-Location $PSScriptRoot
Write-Host "Starting Android Dev Server with Admin Privileges..." -ForegroundColor Green
npx tauri android dev
Read-Host -Prompt "Press Enter to exit"
