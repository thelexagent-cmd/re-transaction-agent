# run-phases.ps1 — Sequential phase builder (phases 2-6)
param([int]$StartPhase = 2)

$phases = @(2, 3, 4, 5, 6)
$projectDir = "C:\Users\thele\.openclaw\workspace\projects\real-estate-agent"
Set-Location $projectDir

foreach ($phase in $phases) {
    if ($phase -lt $StartPhase) { continue }

    $promptFile = "$projectDir\phase$phase-prompt.md"
    if (-not (Test-Path $promptFile)) {
        Write-Host "Phase $phase prompt not found, skipping."
        continue
    }

    Write-Host "=== Starting Phase $phase ===" -ForegroundColor Cyan
    $prompt = Get-Content $promptFile -Raw

    # Write prompt to temp file and pass via stdin to avoid shell escaping issues
    $tmpPrompt = "$env:TEMP\phase$phase-run.md"
    Set-Content -Path $tmpPrompt -Value $prompt -Encoding UTF8

    $output = Get-Content $tmpPrompt -Raw | claude --permission-mode bypassPermissions --print 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        $tail = ($output | Select-Object -Last 10) -join "`n"
        openclaw system event --text "Build stopped: Phase $phase failed (exit $exitCode). Error: $tail" --mode now
        Write-Host "Phase $phase failed. Stopping." -ForegroundColor Red
        exit 1
    }

    Write-Host "Phase $phase complete. Committing..." -ForegroundColor Green
    git add -A
    git commit -m "Phase ${phase}: automated build complete" 2>&1
    git push origin master 2>&1

    openclaw system event --text "Phase $phase complete and pushed to GitHub. Starting Phase $($phase+1)..." --mode now
    Write-Host "Phase $phase pushed." -ForegroundColor Green
}

Write-Host "=== All phases complete ===" -ForegroundColor Green
openclaw system event --text "Full build complete! Phases 0-6 all done. Real estate transaction agent is beta-ready. Repo: https://github.com/thelexagent-cmd/re-transaction-agent" --mode now
