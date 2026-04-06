$headers = @{
    Authorization = 'Bearer YrGg4X15lP5oHyBqrkIDCbQHmmsiY1sunFWtD6uF94927807'
}

# Try stop
Write-Host "Stopping VPS..."
try {
    $result = Invoke-RestMethod -Uri 'https://developers.hostinger.com/api/vps/v1/virtual-machines/1558058/stop' -Headers $headers -Method Post
    Write-Host "Stop:" ($result | ConvertTo-Json -Depth 3)
    
    Write-Host "Waiting 30s..."
    Start-Sleep -Seconds 30
    
    Write-Host "Starting VPS..."
    $result = Invoke-RestMethod -Uri 'https://developers.hostinger.com/api/vps/v1/virtual-machines/1558058/start' -Headers $headers -Method Post
    Write-Host "Start:" ($result | ConvertTo-Json -Depth 3)
    
    Write-Host "Waiting 60s..."
    Start-Sleep -Seconds 60
} catch {
    $response = $_.Exception.Response
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    Write-Host "Error:" $reader.ReadToEnd()
}

# Check actions
$actions = Invoke-RestMethod -Uri 'https://developers.hostinger.com/api/vps/v1/virtual-machines/1558058/actions' -Headers $headers -Method Get
foreach ($a in $actions.data[0..5]) {
    Write-Host "$($a.id): $($a.name) - $($a.state)"
}

# Check projects
$projects = Invoke-RestMethod -Uri 'https://developers.hostinger.com/api/vps/v1/virtual-machines/1558058/docker' -Headers $headers -Method Get
foreach ($p in $projects) {
    Write-Host "`n$($p.name): $($p.state)"
    foreach ($c in $p.containers) {
        Write-Host "  $($c.name): $($c.state) - $($c.status)"
    }
}
