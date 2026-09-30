<#
.SYNOPSIS
    Cuts a new KraoQ release and publishes it to GitHub.

.DESCRIPTION
    Bumps the app version, commits it, creates a git tag, and pushes both to
    origin. Pushing the tag triggers the "Release" GitHub Actions workflow,
    which builds the Windows and Linux installers and publishes them as a
    GitHub Release.

    Pass -Alpha to cut a pre-release instead: the version gets an "-alpha.N"
    suffix (for example 0.1.4-alpha.1) and the GitHub Release is marked as a
    pre-release so it is not offered as the latest stable download. Re-running
    -Alpha bumps N (0.1.4-alpha.2, ...). Cutting a normal release while an
    alpha is current promotes that version to a stable release.

    Building is delegated to CI because Linux installers cannot be produced
    natively on Windows.

.PARAMETER Version
    Version to release (e.g. 0.2.0 or v0.2.0). Defaults to the next patch, or
    the next alpha of the current target version when -Alpha is set.

.PARAMETER Alpha
    Cut an alpha pre-release instead of a stable release. Both -Alpha and
    --alpha are accepted.

.PARAMETER DryRun
    Preview the version bump without changing or pushing anything.

.EXAMPLE
    ./release.ps1
    ./release.ps1 --alpha
    ./release.ps1 0.2.0
    ./release.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$Version,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Extra,
    [switch]$Alpha,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$tauriConf = 'frontend/src-tauri/tauri.conf.json'
$packageJson = 'frontend/package.json'

# PowerShell binds the single-dash form (-Alpha) to the switch, but the
# double-dash form (--alpha) arrives as a positional argument that can land in
# $Version or the catch-all depending on the other arguments. Normalise both.
$extraArgs = @()
if ($null -ne $Extra) { $extraArgs = @($Extra) }

if ($Version -match '^--?alpha$') { $Alpha = $true; $Version = '' }

$remaining = @()
foreach ($arg in $extraArgs) {
    if ($arg -match '^--?alpha$') { $Alpha = $true } else { $remaining += $arg }
}

if (-not $Version -and $remaining.Count -gt 0) {
    $Version = $remaining[0]
    $remaining = @($remaining | Select-Object -Skip 1)
}
if ($remaining.Count -gt 0) { throw "Unknown argument(s): $($remaining -join ', ')." }

function Get-JsonVersion([string]$Path) {
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json).version
}

function Set-JsonVersion([string]$Path, [string]$NewVersion) {
    $full = (Resolve-Path -LiteralPath $Path).Path
    $text = [IO.File]::ReadAllText($full)
    $updated = ([regex]'("version"\s*:\s*")[^"]*(")').Replace($text, '${1}' + $NewVersion + '${2}', 1)
    if ($updated -eq $text) { throw "Could not find a version field in $Path" }
    [IO.File]::WriteAllText($full, $updated)
}

# Windows installers reject pre-release identifiers ("0.1.4-alpha.1" cannot be
# turned into a valid MSI product version), so the app version needs an explicit
# numeric MSI version. Kept in sync with the numeric core of the app version.
function Set-WixVersion([string]$Path, [string]$NumericVersion) {
    $full = (Resolve-Path -LiteralPath $Path).Path
    $text = [IO.File]::ReadAllText($full)
    $pattern = '("wix"\s*:\s*\{\s*"version"\s*:\s*")[^"]*(")'
    if ($text -notmatch $pattern) { throw "Could not find bundle.windows.wix.version in $Path" }
    $updated = [regex]::Replace($text, $pattern, '${1}' + $NumericVersion + '${2}', 1)
    [IO.File]::WriteAllText($full, $updated)
}

# The "X.Y.Z" part of a version, dropping any pre-release or build metadata.
function Get-CoreVersion([string]$v) {
    return ($v -split '[-+]')[0]
}

# The pre-release label (e.g. "alpha.1"), or an empty string when stable.
function Get-PrereleaseLabel([string]$v) {
    if ($v -match '-(?<pre>[0-9A-Za-z.\-]+)') { return $Matches['pre'] }
    return ''
}

function Get-NextPatch([string]$core) {
    $parts = $core.Split('.')
    return "$($parts[0]).$($parts[1]).$([int]$parts[2] + 1)"
}

# The next -alpha.N number for a target version, based on the tags already cut.
function Get-NextAlphaNumber([string]$core) {
    $next = 1
    foreach ($t in @(git tag --list "v$core-alpha.*")) {
        if ($t -match '^v.+?-alpha\.(\d+)$') {
            $n = [int]$Matches[1]
            if ($n -ge $next) { $next = $n + 1 }
        }
    }
    return $next
}

$current = Get-JsonVersion $tauriConf
$currentCore = Get-CoreVersion $current
$currentIsPrerelease = [bool](Get-PrereleaseLabel $current)

if ($Version) {
    $Version = $Version.TrimStart('v')
    if ($Alpha -and $Version -notmatch '-') {
        $Version = "$Version-alpha.$(Get-NextAlphaNumber (Get-CoreVersion $Version))"
    }
} elseif ($Alpha) {
    # Alpha of the next version, or of the current target if we are already on one.
    if ($currentIsPrerelease) { $target = $currentCore } else { $target = Get-NextPatch $currentCore }
    $Version = "$target-alpha.$(Get-NextAlphaNumber $target)"
} else {
    # Stable release: promote the current target, or bump the patch when stable.
    if ($currentIsPrerelease) { $Version = $currentCore } else { $Version = Get-NextPatch $currentCore }
}

if ($Version -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z.\-]+)?$') {
    throw "Version must look like X.Y.Z or X.Y.Z-alpha.N (got '$Version')."
}

$core = Get-CoreVersion $Version
$kind = 'stable'
if (Get-PrereleaseLabel $Version) { $kind = 'alpha pre-release' }
$tag = "v$Version"

Write-Host "KraoQ release: $current -> $Version ($kind, tag $tag)" -ForegroundColor Cyan

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'master') { throw "Releases must be cut from 'master' (currently on '$branch')." }
if (git status --porcelain --untracked-files=no) {
    throw "Working tree has uncommitted changes. Commit or stash them before releasing."
}
if (git tag --list $tag) { throw "Tag $tag already exists." }

git fetch origin --quiet
if ((git rev-parse HEAD) -ne (git rev-parse origin/master)) {
    throw "Local 'master' is not in sync with origin/master. Push or pull first."
}

if ($DryRun) {
    Write-Host "[dry-run] Would bump to $Version, commit, tag $tag, and push." -ForegroundColor Yellow
    return
}

Set-JsonVersion $tauriConf $Version
Set-WixVersion $tauriConf $core
Set-JsonVersion $packageJson $Version

git add -- $tauriConf $packageJson
git commit -m "chore(release): $tag"
git tag $tag
git push origin master
git push origin $tag

$remote = (git remote get-url origin).Trim() -replace '\.git$', ''
Write-Host "Pushed $tag. GitHub Actions is building the installers now." -ForegroundColor Green
Write-Host "  Workflow: $remote/actions/workflows/release.yml"
Write-Host "  Release:  $remote/releases/tag/$tag"
