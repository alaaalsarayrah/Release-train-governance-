param(
  [switch]$UseInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$projects = @(
  ".",
  "release-governance-studio",
  "mobile"
)

foreach ($project in $projects) {
  $projectPath = Join-Path $repoRoot $project
  $packageJson = Join-Path $projectPath "package.json"

  if (-not (Test-Path $packageJson)) {
    continue
  }

  Write-Host "Installing dependencies in $projectPath" -ForegroundColor Cyan
  Push-Location $projectPath

  try {
    $hasLock = Test-Path (Join-Path $projectPath "package-lock.json")

    if ($UseInstall -or -not $hasLock) {
      npm install
    } else {
      npm ci
    }
  }
  finally {
    Pop-Location
  }
}

Write-Host "All npm dependencies installed." -ForegroundColor Green
