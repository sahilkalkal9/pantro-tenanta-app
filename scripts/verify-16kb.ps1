<#
    verify-16kb.ps1
    ---------------------------------------------------------------------------
    Verifies that the release APK satisfies Google Play's 16 KB memory page
    size requirement (mandatory for apps targeting Android 15 / API 35+).

    Two checks are performed:

      1. ZIP alignment - every native library must be stored uncompressed and
         aligned to a 16 KB boundary inside the APK.
         Run with:  zipalign -c -P 16 -v 4 <apk>

      2. ELF alignment - every PT_LOAD segment of every .so must be aligned
         to at least 16 KB (p_align >= 0x4000).

    Usage:
      powershell -ExecutionPolicy Bypass -File scripts/verify-16kb.ps1
#>
[CmdletBinding()]
param(
    [string]$ApkPath
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot

if (-not $ApkPath) {
    $ApkPath = Join-Path $projectRoot 'android\app\build\outputs\apk\release\app-release.apk'
}
if (-not (Test-Path $ApkPath)) {
    throw "APK not found: $ApkPath`nBuild it first: npm run build:apk"
}
Write-Host "APK: $ApkPath" -ForegroundColor Cyan

# --- locate zipalign + llvm-readelf ---------------------------------------
$sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, 'C:\Android',
                   (Join-Path $env:LOCALAPPDATA 'Android\Sdk')) |
                  Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
if (-not $sdkCandidates) { throw 'Android SDK not found. Set ANDROID_HOME.' }
# NOTE: wrap in @() - a single result from Select-Object is a String and
# `$str[0]` would return its first *character*.
$sdk = @($sdkCandidates)[0]

$zipalign = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory -ErrorAction SilentlyContinue |
             Sort-Object Name -Descending |
             ForEach-Object { Join-Path $_.FullName 'zipalign.exe' } |
             Where-Object { Test-Path $_ } | Select-Object -First 1

$readelf = Get-ChildItem (Join-Path $sdk 'ndk') -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object {
                Join-Path $_.FullName 'toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-readelf.exe'
            } |
            Where-Object { Test-Path $_ } | Select-Object -First 1

$failed = $false
$skipped = $false

# --- check 1: zip alignment ------------------------------------------------
if ($zipalign) {
    Write-Host ''
    Write-Host '1) zipalign -c -P 16 (native libs must be 16 KB aligned in the APK)' -ForegroundColor Cyan
    $out = & $zipalign -c -P 16 -v 4 $ApkPath 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host '   PASS - all entries are aligned for 16 KB page sizes.' -ForegroundColor Green
    }
    else {
        $failed = $true
        Write-Host '   FAIL - zipalign reported a problem:' -ForegroundColor Red
        $out | Select-Object -Last 20 | ForEach-Object { "     $_" }
    }
}
else {
    Write-Host '1) zipalign not found - skipping ZIP alignment check.' -ForegroundColor Yellow
    $skipped = $true
}

# --- check 2: ELF PT_LOAD alignment ----------------------------------------
if ($readelf) {
    Write-Host ''
    Write-Host '2) ELF PT_LOAD segment alignment (p_align >= 0x4000)' -ForegroundColor Cyan

    $tmp = Join-Path $env:TEMP ("pantro-16kb-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    try {
        Copy-Item $ApkPath (Join-Path $tmp 'app.zip')
        Expand-Archive -Path (Join-Path $tmp 'app.zip') -DestinationPath (Join-Path $tmp 'extracted') -Force

        $soFiles = Get-ChildItem (Join-Path $tmp 'extracted\lib') -Recurse -Filter '*.so' -File -ErrorAction SilentlyContinue
        if (-not $soFiles) { $soFiles = @() }

        # Google Play's 16 KB rule applies to 64-bit devices only
        # (arm64-v8a, x86_64, riscv64). 32-bit ABIs are reported but not enforced.
        $enforceAbis = @('arm64-v8a', 'x86_64', 'riscv64')

        $bad = @()
        $info = @()
        foreach ($so in $soFiles) {
            # ...\lib\<abi>\<lib>.so
            $abi = Split-Path (Split-Path $so.FullName -Parent) -Leaf
            $programHeaders = & $readelf -l $so.FullName 2>&1 | Out-String
            # LOAD lines look like:  LOAD  0x000000 0x000000 ... 0x1000
            $loads = ($programHeaders -split "`n") | Where-Object { $_ -match '^\s*LOAD\s' }
            foreach ($line in $loads) {
                $cols = ($line -split '\s+') | Where-Object { $_ -ne '' }
                $align = $cols[-1]
                try {
                    $value = [Convert]::ToInt64($align, 16)
                    $entry = "{0,-14} {1,-32} align 0x{2:X}" -f $abi, $so.Name, $value
                    if ($enforceAbis -contains $abi) {
                        if ($value -lt 0x4000) { $bad += $entry }
                    }
                    elseif ($value -lt 0x4000) {
                        $info += $entry
                    }
                }
                catch { }
            }
        }

        if ($info.Count) {
            Write-Host ("   note: {0} 32-bit segment(s) are 4 KB aligned - not required by Play." -f $info.Count) -ForegroundColor DarkGray
        }

        if ($bad.Count -eq 0) {
            Write-Host ("   PASS - all 64-bit native libraries ({0} ABIs) are 16 KB aligned." -f ($enforceAbis -join ', ')) -ForegroundColor Green
        }
        else {
            $failed = $true
            Write-Host ("   FAIL - {0} 64-bit libraries are not 16 KB aligned:" -f $bad.Count) -ForegroundColor Red
            $bad | Select-Object -Unique | ForEach-Object { "     $_" }
        }
    }
    finally {
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}
else {
    Write-Host '2) llvm-readelf not found - skipping ELF alignment check.' -ForegroundColor Yellow
    $skipped = $true
}

Write-Host ''
if ($skipped) {
    Write-Host 'RESULT: INCONCLUSIVE - one or both checks could not run (tools missing).' -ForegroundColor Yellow
    exit 2
}
if ($failed) {
    Write-Host 'RESULT: NOT 16 KB page size compatible.' -ForegroundColor Red
    exit 1
}
Write-Host 'RESULT: 16 KB page size compatible - OK for Google Play.' -ForegroundColor Green
exit 0
