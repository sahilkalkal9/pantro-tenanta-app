<#
    build-android-release.ps1
    ---------------------------------------------------------------------------
    Builds the signed Play Store artifacts for the Pantro Tenant app.

      -Target aab   -> android/app/build/outputs/bundle/release/app-release.aab
      -Target apk   -> android/app/build/outputs/apk/release/app-release.apk

    Requirements: JDK 17+ (JAVA_HOME or a JDK under Program Files\Eclipse Adoptium)
    and an Android SDK with the platform/build-tools requested by app.json.
#>
[CmdletBinding()]
param(
    [ValidateSet('aab', 'apk', 'both')]
    [string]$Target = 'aab',

    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir  = Join-Path $projectRoot 'android'

if (-not (Test-Path $androidDir)) {
    throw 'android/ not found. Run: npx expo prebuild --platform android --clean'
}

# --- JDK --------------------------------------------------------------------
function Get-JavaMajor([string]$javaHome) {
    $exe = Join-Path $javaHome 'bin\java.exe'
    if (-not (Test-Path $exe)) { return 0 }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'   # `java -version` writes to stderr
    try {
        $v = (& $exe -version 2>&1 | Out-String)
    } finally {
        $ErrorActionPreference = $prev
    }
    if ($v -notmatch '"(\d+)') { return 0 }
    $major = [int]$Matches[1]
    if ($major -eq 1 -and $v -match '"1\.(\d+)') { $major = [int]$Matches[1] }
    return $major
}

function Resolve-JavaHome {
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        if ((Get-JavaMajor $env:JAVA_HOME) -ge 17) { return $env:JAVA_HOME }
    }
    $candidates = @()
    $candidates += Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -ErrorAction SilentlyContinue |
                   Where-Object { $_.Name -match 'jdk-(17|21)' } |
                   Sort-Object Name -Descending | Select-Object -ExpandProperty FullName
    $candidates += Get-ChildItem 'C:\Program Files\Android\Android Studio\jbr' -Directory -ErrorAction SilentlyContinue |
                   Select-Object -ExpandProperty FullName
    foreach ($c in $candidates) {
        if (-not $c) { continue }
        if ((Get-JavaMajor $c) -ge 17) { return $c }
    }
    throw 'JDK 17+ not found. Install Temurin 17/21 and set JAVA_HOME.'
}

$env:JAVA_HOME = Resolve-JavaHome
Write-Host "JAVA_HOME = $env:JAVA_HOME"

# --- Android SDK ------------------------------------------------------------
$sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, 'C:\Android',
                   (Join-Path $env:LOCALAPPDATA 'Android\Sdk')) |
                  Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
if (-not $sdkCandidates) { throw 'Android SDK not found. Set ANDROID_HOME.' }
# NOTE: wrap in @() - a single result from Select-Object is a String and
# `$str[0]` would return its first *character*.
$env:ANDROID_HOME = @($sdkCandidates)[0]
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
Write-Host "ANDROID_HOME = $env:ANDROID_HOME"

$localProps = Join-Path $androidDir 'local.properties'
# Forward slashes avoid Java .properties backslash-escape problems (C:\Android -> C:Android)
$sdkDir = $env:ANDROID_HOME -replace '\\', '/'
Set-Content -Path $localProps -Value "sdk.dir=$sdkDir" -Encoding ASCII
Write-Host "wrote $localProps -> sdk.dir=$sdkDir"

# --- build ------------------------------------------------------------------
Set-Location $androidDir

# expo-constants' `createExpoConfig` task warns (and skips .env.<NODE_ENV>) when
# NODE_ENV is unset. A release bundle must always be built with production env.
if (-not $env:NODE_ENV) { $env:NODE_ENV = 'production' }
Write-Host "NODE_ENV = $env:NODE_ENV"

$gradlew = if ($IsWindows -or $env:OS -eq 'Windows_NT') { '.\gradlew.bat' } else { './gradlew' }

# Gradle's artifact-transform cache can be left half-written by an interrupted
# build. The orphaned entries then break every later build with
# "Could not read workspace metadata from ...\transforms\<hash>\metadata.bin".
# Repairing up-front is cheap (a directory scan) and makes the build reliable.
$repairScript = Join-Path $PSScriptRoot 'repair-gradle-transform-cache.ps1'
if (Test-Path $repairScript) {
    Write-Host 'Checking Gradle transform cache...' -ForegroundColor DarkGray
    & $repairScript | Out-Null
}

$tasks = @()
if ($Target -eq 'aab' -or $Target -eq 'both') { $tasks += 'bundleRelease' }
if ($Target -eq 'apk' -or $Target -eq 'both') { $tasks += 'assembleRelease' }

$args = @()
if ($Clean) { $args += 'clean' }
$args += $tasks
$args += '--stacktrace'
# A reused daemon keeps cross-build cache pointers in memory. If the cache
# directory on disk was purged in between, Gradle keeps pointing at the old
# (now missing) paths and aborts with
#   "Could not read workspace metadata from .../transforms/<hash>/metadata.bin".
# A fresh JVM per build avoids that entirely.
$args += '--no-daemon'

Write-Host "gradle $($args -join ' ')" -ForegroundColor Cyan

# Retrying helps with flaky DNS / dropped connections on the long dependency
# download (dl.google.com, repo.maven.apache.org).
$maxAttempts = 3
$gradleExit = 1
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'   # gradle writes progress to stderr
    try {
        & $gradlew @args
        $gradleExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevPref
    }

    if ($gradleExit -eq 0) { break }

    if ($attempt -lt $maxAttempts) {
        Write-Host ''
        Write-Host "Gradle failed (exit $gradleExit) - repairing Gradle cache and retrying in 20s [$attempt/$maxAttempts]..." -ForegroundColor Yellow
        if (Test-Path $repairScript) {
            & $repairScript
            if ($LASTEXITCODE -ne 0) {
                Write-Host 'Cache repair reported a problem - continuing with the retry anyway.' -ForegroundColor Yellow
            }
        }
        Start-Sleep -Seconds 20
        Write-Host ''
    }
}
if ($gradleExit -ne 0) { throw "Gradle failed with exit code $gradleExit" }

# --- report -----------------------------------------------------------------
Write-Host ''
Write-Host 'Build output:' -ForegroundColor Green
$aab = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'
$apk = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
foreach ($f in @($aab, $apk)) {
    if (Test-Path $f) {
        $item = Get-Item $f
        Write-Host ("  {0}  ({1:N2} MB)" -f $item.FullName, ($item.Length / 1MB))
    }
}
Write-Host ''
