$ErrorActionPreference = "Stop"

Write-Host "Starting Terraform Auto-Retry Script for OCI allocation..." -ForegroundColor Cyan

$retryCount = 0

while ($true) {
    $retryCount++
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] Attempt #$retryCount to apply Terraform..." -ForegroundColor Yellow

    try {
        # Run terraform apply and capture the output
        terraform apply -auto-approve
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Success! Resources have been provisioned." -ForegroundColor Green
            break
        }
    }
    catch {
        Write-Host "An unexpected error occurred executing the command." -ForegroundColor Red
    }

    Write-Host "Allocation failed (likely out of capacity). Waiting 60 seconds before next retry..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 60
}
