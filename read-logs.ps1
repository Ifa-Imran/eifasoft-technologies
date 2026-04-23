$raw = Get-Content "C:\Users\imran\.qoder\cache\projects\KAIRODAO-157a1cfd\agent-tools\bbb92b72\863d5cb1.txt" -Raw
$data = $raw | ConvertFrom-Json

Write-Output "Total services: $($data.Count)"
foreach ($svc in $data) {
    Write-Output "Service: '$($svc.service)' - Entries: $($svc.entries.Count)"
}
