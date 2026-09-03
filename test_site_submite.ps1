Write-Host "=== Browser-Style Form Submission Test ==="

$SiteUrl = "https://www.kemptvillecreativewriters.com"

Write-Host "`n[1] Fetching homepage..."
$homepage = Invoke-WebRequest -Uri $SiteUrl -UseBasicParsing

# Extract the form action from the HTML
Write-Host "[2] Extracting form action..."
$formAction = ($homepage.RawContent -match 'action="([^"]+)"') | Out-Null
$formAction = $Matches[1]

if (-not $formAction) {
    Write-Host "❌ No form action found in homepage HTML"
    exit
}

Write-Host "✔ Found form action: $formAction"

# Build POST body with only required fields
$body = @{
    email = "powershell-browser-test@example.com"
}

Write-Host "`n[3] Submitting form to: $formAction"

$response = Invoke-WebRequest -Uri $formAction -Method POST -Body $body -UseBasicParsing -MaximumRedirection 10

Write-Host "`n[4] Final URL: $($response.BaseResponse.ResponseUri.AbsoluteUri)"

if ($response.BaseResponse.ResponseUri.AbsoluteUri -match "script.googleusercontent.com/macros/echo") {
    Write-Host "`n❌ Redirected to Google ECHO endpoint — doPost() was NOT called"
} else {
    Write-Host "`n✔ Web App endpoint reached — doPost() SHOULD have fired"
}

Write-Host "`n[5] Response Body:"
Write-Host $response.Content

Write-Host "`n=== Test Complete ==="
