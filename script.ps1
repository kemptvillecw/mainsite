Write-Host "=== Kemptville Creative Writers Newsletter Diagnostic ===" -ForegroundColor Cyan

# ------------------------------------------------------------
# CONFIG
# ------------------------------------------------------------
$HtmlPath = "D:\Personal\kemptvillecreativewriters\mainsite\index.html"
$JsPath   = "D:\Personal\kemptvillecreativewriters\mainsite\scripts\form-helpers.js"
$SheetId  = "10UOf3dzUJ_7-Znar1SAOmPmLTbKW9t9OsdppqR4I4Pk"
$WebAppUrl = "https://script.google.com/macros/s/AKfycbzru3lhwrnlQvkTceBERR-gb0wIguAX3PvkOQN71QUIRLzAYayXG9MtI5Cgt7E84vciig/exec"

# ------------------------------------------------------------
# 1. CHECK HTML
# ------------------------------------------------------------
Write-Host "`n[1] Checking HTML file..." -ForegroundColor Yellow

if (-Not (Test-Path $HtmlPath)) {
    Write-Host "HTML file not found at $HtmlPath" -ForegroundColor Red
} else {
    $html = Get-Content $HtmlPath -Raw

    if ($html -match $WebAppUrl) {
        Write-Host "✔ Form action URL matches deployment" -ForegroundColor Green
    } else {
        Write-Host "❌ Form action URL does NOT match deployment" -ForegroundColor Red
    }

    if ($html -match "middle_name") {
        Write-Host "✔ Honeypot field present" -ForegroundColor Green
    } else {
        Write-Host "❌ Honeypot field missing" -ForegroundColor Red
    }

    if ($html -match "checksum" -and $html -match "abc123") {
        Write-Host "✔ Checksum field present" -ForegroundColor Green
    } else {
        Write-Host "❌ Checksum field missing or incorrect" -ForegroundColor Red
    }

    if ($html -match "form_started") {
        Write-Host "✔ Timing field present" -ForegroundColor Green
    } else {
        Write-Host "❌ Timing field missing" -ForegroundColor Red
    }
}

# ------------------------------------------------------------
# 2. CHECK JAVASCRIPT
# ------------------------------------------------------------
Write-Host "`n[2] Checking JavaScript file..." -ForegroundColor Yellow

if (-Not (Test-Path $JsPath)) {
    Write-Host "JS file not found at $JsPath" -ForegroundColor Red
} else {
    $js = Get-Content $JsPath -Raw

    if ($js -match "preventDefault") {
        Write-Host "❌ preventDefault() FOUND — this blocks Apps Script POST" -ForegroundColor Red
    } else {
        Write-Host "✔ No preventDefault() — native POST allowed" -ForegroundColor Green
    }

    if ($js -match "fetch") {
        Write-Host "❌ fetch() FOUND — Apps Script does NOT accept CORS fetch POST" -ForegroundColor Red
    } else {
        Write-Host "✔ No fetch() — good" -ForegroundColor Green
    }

    if ($js -match "addEventListener" -and $js -match "submit") {
        Write-Host "❌ JS submit handler FOUND — remove it" -ForegroundColor Red
    } else {
        Write-Host "✔ No JS submit handler — good" -ForegroundColor Green
    }
}

# ------------------------------------------------------------
# 3. CHECK WEB APP DEPLOYMENT
# ------------------------------------------------------------
Write-Host "`n[3] Checking Google Apps Script Web App..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $WebAppUrl -Method GET -UseBasicParsing
    Write-Host "✔ Web App reachable" -ForegroundColor Green

    if ($response.RawContent -match "echo") {
        Write-Host "❌ Google ECHO endpoint detected — wrong project or wrong deployment" -ForegroundColor Red
    } else {
        Write-Host "✔ Correct Web App endpoint" -ForegroundColor Green
    }
}
catch {
    Write-Host "❌ Web App unreachable" -ForegroundColor Red
}

# ------------------------------------------------------------
# 4. CHECK SHEET
# ------------------------------------------------------------
Write-Host "`n[4] Checking Google Sheet ID..." -ForegroundColor Yellow

if ($SheetId -match "10UOf3dzUJ_7-Znar1SAOmPmLTbKW9t9OsdppqR4I4Pk") {
    Write-Host "✔ Sheet ID matches backend" -ForegroundColor Green
} else {
    Write-Host "❌ Sheet ID mismatch" -ForegroundColor Red
}

# ------------------------------------------------------------
# 5. CHECK DNS / NETWORK
# ------------------------------------------------------------
Write-Host "`n[5] Checking DNS and network..." -ForegroundColor Yellow

try {
    Resolve-DnsName "script.google.com" | Out-Null
    Write-Host "✔ DNS OK" -ForegroundColor Green
}
catch {
    Write-Host "❌ DNS resolution failed" -ForegroundColor Red
}

try {
    Test-NetConnection -ComputerName "script.google.com" -Port 443 | Out-Null
    Write-Host "✔ HTTPS connectivity OK" -ForegroundColor Green
}
catch {
    Write-Host "❌ HTTPS connectivity failed" -ForegroundColor Red
}

# ------------------------------------------------------------
# 6. CHECK LIVE SITE
# ------------------------------------------------------------
Write-Host "`n[6] Checking live site..." -ForegroundColor Yellow

try {
    $live = Invoke-WebRequest -Uri "https://www.kemptvillecreativewriters.com" -UseBasicParsing
    if ($live.RawContent -match $WebAppUrl) {
        Write-Host "✔ Live site contains correct form action" -ForegroundColor Green
    } else {
        Write-Host "❌ Live site does NOT contain correct form action — GitHub Pages may be serving stale HTML" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Live site unreachable" -ForegroundColor Red
}

Write-Host "`n=== Diagnostic Complete ===" -ForegroundColor Cyan
