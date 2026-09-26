<#
.SYNOPSIS
    Cuts a new KraoQ release and publishes it to GitHub.

.DESCRIPTION
    Bumps the app version, commits it, creates a git tag, and pushes both to
    origin. Pushing the tag triggers the "Release" GitHub Actions workflow,
    which builds the Windows and Linux installers and publishes them as a
    GitHub Release.

    Building is delegated to CI because Linux installers cannot be produced
    natively on Windows.

.PARAMETER Version
    Version to release (e.g. 0.2.0 or v0.2.0). Defaults to the next patch.

.PARAMETER DryRun
    Preview the version bump without changing or pushing anything.

.EXAMPLE
    ./release.ps1
    ./release.ps1 0.2.0
    ./release.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$Version,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$tauriConf = 'frontend/src-tauri/tauri.conf.json'
$packageJson = 'frontend/package.json'

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

$current = Get-JsonVersion $tauriConf
if (-not $Version) {
    $parts = $current.Split('.')
    if ($parts.Count -ne 3) { throw "Unexpected current version '$current'." }
    $Version = "$($parts[0]).$($parts[1]).$([int]$parts[2] + 1)"
}
$Version = $Version.TrimStart('v')
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Version must look like X.Y.Z (got '$Version')." }
$tag = "v$Version"

Write-Host "KraoQ release: $current -> $Version (tag $tag)" -ForegroundColor Cyan

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
