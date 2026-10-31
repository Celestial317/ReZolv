# Start the ReZolv API so other devices on the same Wi-Fi can reach it.
#   powershell -ExecutionPolicy Bypass -File server\start_lan.ps1
# Needs Docker Desktop running. Seeds demo data only when the database is empty.
$ErrorActionPreference = "Stop"
$server = $PSScriptRoot
$root = Split-Path $server -Parent
$py = Join-Path $server ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
  python -m venv (Join-Path $server ".venv")
  & $py -m pip install -q -r (Join-Path $server "requirements.txt")
}

docker compose -f (Join-Path $root "docker-compose.yml") up -d yugabytedb

Set-Location $server
& $py -m scripts.migrate
& $py -c "import db,sys; db.init(); sys.exit(0 if db.fetchone('SELECT 1 AS x FROM users LIMIT 1') else 1)"
if ($LASTEXITCODE -ne 0) { & $py seed.py }

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -match '^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\.' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "API for the phone app and the dashboard:  http://${ip}:8000" -ForegroundColor Green
Write-Host "Docs: http://${ip}:8000/docs"
Write-Host ""
& $py -m uvicorn main:app --host 0.0.0.0 --port 8000
