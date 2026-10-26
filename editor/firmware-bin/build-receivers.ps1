$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
Push-Location $here
try {
  node (Join-Path $here "build-all-receivers.mjs")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
