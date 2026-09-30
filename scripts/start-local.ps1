param([string]$LanIp = '192.168.0.3')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$nodeCommand = (Get-Command node).Source
$logDirectory = Join-Path $workspace '.local-logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

Push-Location $workspace
try {
  & docker compose up -d
  if ($LASTEXITCODE -ne 0) { throw 'Docker nao iniciou todos os servicos.' }
} finally { Pop-Location }

function Start-LocalService($name, $port, $directory, $nodeArguments) {
  $existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($existing) { Write-Output "$name : porta $port ja ocupada; processo existente preservado."; return }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $outLog = Join-Path $logDirectory "$name-$stamp.out.log"
  $errorLog = Join-Path $logDirectory "$name-$stamp.err.log"
  $process = Start-Process -FilePath $nodeCommand -ArgumentList $nodeArguments -WorkingDirectory $directory -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errorLog -PassThru
  Write-Output "$name iniciado (PID $($process.Id)); porta $port; logs: $outLog"
}

Start-LocalService 'api' 3000 (Join-Path $workspace 'backend') @('src/server.js')
$nextCli = Join-Path $workspace 'node_modules/next/dist/bin/next'
$buildId = Join-Path $workspace 'admin-web/.next/BUILD_ID'
$adminMode = if (Test-Path -LiteralPath $buildId) { 'start' } else { 'dev' }
Start-LocalService 'admin' 3001 (Join-Path $workspace 'admin-web') @(('"' + $nextCli + '"'), $adminMode, '-p', '3001')

$oldExpoHost = $env:REACT_NATIVE_PACKAGER_HOSTNAME
try {
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $LanIp
  $expoCli = Join-Path $workspace 'node_modules/expo/bin/cli'
  Start-LocalService 'expo' 8081 (Join-Path $workspace 'driver-app') @(('"' + $expoCli + '"'), 'start', '--lan', '--port', '8081')
} finally { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $oldExpoHost }

Write-Output 'Admin: http://localhost:3001/login'
Write-Output "Metro: http://${LanIp}:8081 (Bluetooth exige APK proprio; Expo Go nao inclui o modulo BLE)."
Write-Output 'O simulador nao e iniciado. Confira os logs se alguma porta nao responder.'
