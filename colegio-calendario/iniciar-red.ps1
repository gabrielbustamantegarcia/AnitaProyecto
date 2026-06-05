param(
  [int]$Puerto = 8080
)

$directorioProyecto = Split-Path -Parent $MyInvocation.MyCommand.Path

$ipLocal = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -ne "127.0.0.1" -and
    $_.IPAddress -notlike "169.254*" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host ""
Write-Host "Servidor iniciado para Agenda Escolar" -ForegroundColor Cyan
Write-Host "Abre en esta computadora: http://localhost:$Puerto" -ForegroundColor Green
if ($ipLocal) {
  Write-Host "Abre en otras computadoras (misma red): http://$ipLocal`:$Puerto" -ForegroundColor Yellow
} else {
  Write-Host "No se detectó IP de red local automática. Usa ipconfig para verla." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Presiona Ctrl+C para detener el servidor." -ForegroundColor DarkGray
Write-Host ""

Start-Process "http://localhost:$Puerto" | Out-Null
python -m http.server $Puerto --bind 0.0.0.0 --directory $directorioProyecto
