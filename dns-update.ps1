$body = Get-Content -Raw 'e:\Projects\KAIRODAO\dns-update.json'
$headers = @{
    Authorization = 'Bearer YrGg4X15lP5oHyBqrkIDCbQHmmsiY1sunFWtD6uF94927807'
}
$result = Invoke-RestMethod -Uri 'https://developers.hostinger.com/api/dns/v1/zones/kairodao.com' -Headers $headers -ContentType 'application/json' -Method Put -Body $body
$result | ConvertTo-Json -Depth 10
