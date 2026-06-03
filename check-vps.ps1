param()
$ErrorActionPreference = 'Continue'

$h = @{ Authorization = 'Bearer YrGg4X15lP5oHyBqrkIDCbQHmmsiY1sunFWtD6uF94927807' }

Write-Host "=== VM STATE ==="
try {
    $vm = Invoke-RestMethod -Uri 'https://developers.hostinger.com/api/vps/v1/virtual-machines/1558058' -Headers $h
    Write-Host ("state=" + $vm.state)
    Write-Host ("status=" + $vm.status)
    Write-Host ("hostname=" + $vm.hostname)
    Write-Host ("ipv4=" + ($vm.ipv4 | ConvertTo-Json -Compress))
} catch {
    Write-Host ("VM ERR: " + $_.Exception.Message)
}

Write-Host ""
Write-Host "=== DOCKER PROJECTS ==="
try {
    $projects = Invoke-RestMethod -Uri 'https://developers.hostinger.com/api/vps/v1/virtual-machines/1558058/docker' -Headers $h
    foreach ($p in $projects) {
        Write-Host ""
        Write-Host ("Project: " + $p.name + " | state=" + $p.state + " | path=" + $p.path)
        if ($p.containers) {
            foreach ($c in $p.containers) {
                $health = $c.health
                if (-not $health) { $health = "n/a" }
                Write-Host ("  - " + $c.name + " | " + $c.state + " | " + $c.status + " | health=" + $health)
            }
        }
    }
} catch {
    Write-Host ("DK ERR: " + $_.Exception.Message)
}

Write-Host ""
Write-Host "=== RECENT VM ACTIONS ==="
try {
    $actions = Invoke-RestMethod -Uri 'https://developers.hostinger.com/api/vps/v1/virtual-machines/1558058/actions' -Headers $h
    $list = $actions
    if ($actions.data) { $list = $actions.data }
    $i = 0
    foreach ($a in $list) {
        if ($i -ge 8) { break }
        Write-Host ("  " + $a.id + " | " + $a.name + " | " + $a.state + " | " + $a.created_at)
        $i++
    }
} catch {
    Write-Host ("ACT ERR: " + $_.Exception.Message)
}
