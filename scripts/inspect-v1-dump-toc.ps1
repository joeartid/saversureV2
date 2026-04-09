param(
    [Parameter(Mandatory = $true)]
    [string]$DumpPath,

    [string[]]$Keywords = @(
        "users",
        "user_address",
        "products",
        "rewards",
        "reward_redeem_histories",
        "qrcode_scan_history",
        "coupons",
        "lucky_draw",
        "news",
        "partner_shops",
        "settings",
        "staffs"
    )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-PgRestore {
    $cmd = Get-Command pg_restore -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $candidate = Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter pg_restore.exe -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName

    if ($candidate) {
        return $candidate
    }

    throw "pg_restore.exe not found. Install PostgreSQL client tools or add pg_restore to PATH."
}

if (-not (Test-Path -LiteralPath $DumpPath)) {
    throw "Dump file not found: $DumpPath"
}

$pgRestore = Resolve-PgRestore

Write-Host "Inspecting dump TOC..." -ForegroundColor Cyan
Write-Host "Dump: $DumpPath"
Write-Host "pg_restore: $pgRestore"
Write-Host ""

$lines = & $pgRestore -l $DumpPath

if (-not $lines) {
    throw "No TOC output returned from pg_restore."
}

Write-Host "=== Header ===" -ForegroundColor Yellow
$lines | Select-Object -First 12
Write-Host ""

Write-Host "=== Matched objects ===" -ForegroundColor Yellow
$pattern = ($Keywords | ForEach-Object { [Regex]::Escape($_) }) -join "|"
$matches = $lines | Select-String -Pattern $pattern

if (-not $matches) {
    Write-Host "No matching TOC entries found for the requested keywords." -ForegroundColor DarkYellow
    exit 0
}

$matches | ForEach-Object { $_.Line }
