param()
$ErrorActionPreference = 'Continue'

function Probe([string]$url) {
    Write-Host ""
    Write-Host "=== $url ==="
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 20 -UseBasicParsing -MaximumRedirection 5
        Write-Host ("STATUS=" + $r.StatusCode)
        Write-Host ("LEN=" + $r.Content.Length)
        $serverHdr = $r.Headers['Server']
        if ($serverHdr) { Write-Host ("Server=" + $serverHdr) }
        $body = $r.Content
        if ($body.Length -gt 800) { $body = $body.Substring(0, 800) }
        Write-Host "--- BODY ---"
        Write-Host $body
    } catch {
        Write-Host ("EXC: " + $_.Exception.Message)
        if ($_.Exception.Response) {
            Write-Host ("RSC: " + $_.Exception.Response.StatusCode)
        }
    }
}

Probe 'https://kairodao.com'
Probe 'https://www.kairodao.com'
Probe 'https://kairodao.com/health'
Probe 'https://kairodao.com/api/v1/health'
Probe 'https://dev.kairodao.com'
Probe 'https://dev.kairodao.com/health'
