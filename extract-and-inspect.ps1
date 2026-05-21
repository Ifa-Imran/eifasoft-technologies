$ErrorActionPreference = 'Stop'
Set-Location 'e:\Projects\KAIRODAO'

# Extract using cmd.exe's > to keep raw bytes (UTF-8/binary preserved)
cmd /c "git cat-file -p e1fda25f029f65316c62968d9c053528a06c6d82 > scripts\backup-old-contracts.ts"
cmd /c "git cat-file -p 073602ec92ce40585cab8c14325c27be971e4335 > backups\snapshot.json"

Write-Host "backup-old-contracts.ts size:" (Get-Item scripts\backup-old-contracts.ts).Length
Write-Host "snapshot.json size:" (Get-Item backups\snapshot.json).Length

# Quickly inspect the snapshot keys
$json = Get-Content backups\snapshot.json -Raw | ConvertFrom-Json
Write-Host "snapshot user count:" $json.users.Count
Write-Host "snapshot top-level keys:" ($json | Get-Member -MemberType NoteProperty | ForEach-Object { $_.Name } -join ', ')
Write-Host "first user keys:" ($json.users[0] | Get-Member -MemberType NoteProperty | ForEach-Object { $_.Name } -join ', ')
Write-Host "first user.affiliate keys:" ($json.users[0].affiliate | Get-Member -MemberType NoteProperty | ForEach-Object { $_.Name } -join ', ')
Write-Host "first user.affiliate.referrer:" $json.users[0].affiliate.referrer
Write-Host "first user.user:" $json.users[0].user
