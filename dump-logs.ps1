param([string]$Path = 'C:\Users\imran\.qoder\cache\projects\KAIRODAO-157a1cfd\agent-tools\9db3cea7\f9b26545.txt')
$ErrorActionPreference = 'Continue'
$c = Get-Content -Raw -Path $Path
Write-Host ("CHARLEN: " + $c.Length)

# This is a JSON object with literal \n escape sequences. Try to decode.
try {
    $obj = $c | ConvertFrom-Json
    Write-Host "Parsed as JSON. Top-level keys:"
    $obj | Get-Member -MemberType NoteProperty | ForEach-Object { Write-Host ("  " + $_.Name) }
    Write-Host ""
    foreach ($k in ($obj | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)) {
        $v = $obj.$k
        if ($v -is [string]) {
            Write-Host ("=== " + $k + " (len=" + $v.Length + ") ===")
            $tail = $v
            if ($tail.Length -gt 6000) { $tail = $tail.Substring($tail.Length - 6000) }
            Write-Host $tail
            Write-Host ""
        } else {
            Write-Host ("=== " + $k + " ===")
            $v | ConvertTo-Json -Depth 5 | Write-Host
        }
    }
} catch {
    Write-Host ("ConvertFrom-Json failed: " + $_.Exception.Message)
    Write-Host "First 4000 chars raw:"
    $head = $c
    if ($head.Length -gt 4000) { $head = $head.Substring(0,4000) }
    Write-Host $head
}
