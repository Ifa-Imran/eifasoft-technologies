$r = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing
$html = $r.Content
Write-Host ("Status: " + $r.StatusCode + " | Length: " + $html.Length)
if ($html -match 'opBNB[^"<]*(Mainnet|Testnet)') { Write-Host ("Network text: " + $matches[0]) }
if ($html -match 'Live on[^"<]*') { Write-Host ("Banner: " + $matches[0]) }
$mainnet = '0x3DA7B98DE7085eda9b991fAD4762b274E9ADb496'
$testnet = '0x611B2c50E0BCcC99E5632c569431C39983126287'
if ($html -match $mainnet) { Write-Host "Has MAINNET KAIRO addr  <-- BAD" } else { Write-Host "No mainnet KAIRO addr OK" }
if ($html -match $testnet) { Write-Host "Has TESTNET KAIRO addr  <-- GOOD" } else { Write-Host "No testnet KAIRO addr  <-- BAD" }
$addrs = $html | Select-String -Pattern '(0x[a-fA-F0-9]{40})' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Unique
Write-Host "Unique 0x addresses found:"
$addrs
