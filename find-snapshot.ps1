$ErrorActionPreference = 'Stop'
Set-Location 'e:\Projects\KAIRODAO'

Write-Host "--- backup script commits (path) ---"
git log --all --oneline -- scripts/backup-old-contracts.ts

Write-Host "--- snapshot json commits (path) ---"
git log --all --oneline -- backups/kairodao-backup-204-143711622-2026-05-17T19-15-53-287Z.json

Write-Host "--- searching all branches for any backup file ---"
git rev-list --all --objects | Select-String -Pattern 'backup-old-contracts' | Select-Object -First 5
git rev-list --all --objects | Select-String -Pattern 'kairodao-backup-204' | Select-Object -First 5
