param(
  [string]$File = ".env.vercel",
  [ValidateSet("production", "preview", "development")]
  [string]$Environment = "production"
)

if (!(Test-Path $File)) {
  Write-Error "Env file not found: $File"
  exit 1
}

$lines = Get-Content $File | Where-Object {
  $_.Trim() -and -not $_.Trim().StartsWith("#")
}

foreach ($line in $lines) {
  $parts = $line -split "=", 2
  if ($parts.Count -ne 2) { continue }

  $name = $parts[0].Trim()
  $value = $parts[1]

  Write-Host "Importing $name to $Environment..."
  $value | vercel env add $name $Environment
}
