param(
  [string]$OutputPath = "hostinger-deploy\global-awakening-hostinger-upload.zip"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$fullOutputPath = Join-Path $projectRoot $OutputPath
$outputDir = Split-Path -Parent $fullOutputPath

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

if (Test-Path $fullOutputPath) {
  Remove-Item $fullOutputPath -Force
}

$itemsToInclude = @(
  "app",
  "components",
  "docs",
  "lib",
  "prisma",
  "public",
  "scripts",
  "services",
  ".env.example",
  ".gitignore",
  ".nvmrc",
  "eslint.config.mjs",
  "next-env.d.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "README.md",
  "tsconfig.json"
)

$paths = $itemsToInclude | ForEach-Object { Join-Path $projectRoot $_ } | Where-Object { Test-Path $_ }

Compress-Archive -Path $paths -DestinationPath $fullOutputPath -CompressionLevel Optimal

Write-Host "Hostinger package created at: $fullOutputPath"
