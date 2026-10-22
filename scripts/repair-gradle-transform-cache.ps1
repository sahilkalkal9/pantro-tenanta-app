<#
    repair-gradle-transform-cache.ps1
    ---------------------------------------------------------------------------
    Removes orphaned entries from Gradle's artifact-transform cache.

    How it breaks
    -------------
    Gradle unpacks each artifact transform result into:

        %GRADLE_USER_HOME%\caches\<gradle-version>\transforms\<hash>\
            transformed\...   <- the unpacked artifact
            metadata.bin      <- cache metadata (written LAST)
            results.bin       <- transform result index (written LAST)

    If a build is interrupted (Ctrl+C, "Cancel" in Android Studio, a killed
    daemon, a machine reboot) between writing `transformed\` and writing
    `metadata.bin`, the entry is left half-written. Every later build that
    needs the same artifact then dies with:

        Could not read workspace metadata from
        C:\Users\hp\.gradle\caches\8.14.3\transforms\<hash>\metadata.bin
        (The system cannot find the file specified)

    and reports it against whichever task first needs the artifact
    (e.g. :react-native-svg:generateReleaseLintModel).

    Deleting the orphaned entries is safe: `transforms\` is a pure cache.
    Gradle regenerates the affected entries on the next build.

    Long paths
    ----------
    The react-android AAR unpacks to paths of ~290 characters (prefab C++
    headers). Windows MAX_PATH is 260 and LongPathsEnabled is 0 on this
    machine, so `Remove-Item -Recurse` fails on them. This script deletes
    with `cmd /c rd /s /q \\?\<path>`, which handles the extended-length
    prefix and therefore works past MAX_PATH.
#>
[CmdletBinding()]
param(
    # Also print entries that are repaired.
    [switch]$Verbose2
)

$ErrorActionPreference = 'Stop'

function Write-Info([string]$Message) {
    Write-Host "  $Message" -ForegroundColor DarkGray
}

# --- locate the Gradle user home --------------------------------------------
$gradleHome = if ($env:GRADLE_USER_HOME) {
    $env:GRADLE_USER_HOME
} else {
    Join-Path $env:USERPROFILE '.gradle'
}
$cachesRoot = Join-Path $gradleHome 'caches'

if (-not (Test-Path $cachesRoot)) {
    Write-Info "No Gradle cache at $cachesRoot - nothing to repair."
    exit 0
}

# --- collect the transform cache roots --------------------------------------
# Layout: caches\<gradle-version>\transforms\<hash>\{transformed,metadata.bin}
$transformRoots = @()
Get-ChildItem $cachesRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+(\.\d+)*' } |
    ForEach-Object {
        $p = Join-Path $_.FullName 'transforms'
        if (Test-Path $p) { $transformRoots += $p }
    }

if ($transformRoots.Count -eq 0) {
    Write-Info 'No artifact-transform cache found - nothing to repair.'
    exit 0
}

# --- find orphaned entries ---------------------------------------------------
$orphans = @()
foreach ($root in $transformRoots) {
    Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        # A complete entry always has metadata.bin next to the transformed/ dir.
        if (-not (Test-Path (Join-Path $_.FullName 'metadata.bin'))) {
            $orphans += $_.FullName
        }
    }
}

if ($orphans.Count -eq 0) {
    Write-Info "Transform cache is healthy ($($transformRoots.Count) cache root(s), no orphaned entries)."
    exit 0
}

Write-Host "Found $($orphans.Count) orphaned Gradle transform cache entr$(if ($orphans.Count -eq 1) { 'y' } else { 'ies' }) - removing." -ForegroundColor Yellow

# --- remove them (long-path safe) -------------------------------------------
$removed = 0
$failed  = @()
foreach ($orphan in $orphans) {
    # "\\?\" tells Win32 to use the extended-length path syntax and bypass
    # MAX_PATH. Without it, rd/Remove-Item fail on these ~290 char paths.
    $extended = "\\?\$orphan"
    & cmd /c "rd /s /q `"$extended`"" 2>$null | Out-Null
    if (-not (Test-Path $orphan)) {
        $removed++
        if ($Verbose2) { Write-Info "removed $orphan" }
    } else {
        $failed += $orphan
    }
}

if ($failed.Count -gt 0) {
    Write-Host "  WARNING: could not remove $($failed.Count) entr$(if ($failed.Count -eq 1) { 'y' } else { 'ies' })." -ForegroundColor Red
    foreach ($f in $failed) { Write-Host "    $f" -ForegroundColor Red }
    exit 1
}

Write-Info "Removed $removed orphaned entr$(if ($removed -eq 1) { 'y' } else { 'ies' }). Gradle will regenerate them."
exit 0
