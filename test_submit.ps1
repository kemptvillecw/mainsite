Write-Host "=== Newsletter Web App POST Test ==="

$WebAppUrl = "https://script.google.com/macros/s/AKfycbx5Okuc25UJN0M5TT2BGR_1hkJ-nnIBfTPTdVnv_USTuR4_KBhLO8l4s-WlzjkOCB3QEQ/exec"

$body = @{
    email        = "powershell-test@example.com"
    middle_name  = ""
    checksum     = "abc123"
    interacted   = "yes"
    form_started = "123456"
    bot_flag     = "false"
}

Write-Host ""
Write-Host "Sending POST request..."

$response = Invoke-WebRequest -Uri $WebAppUrl -Method POST -Body $body -UseBasicParsing

Write-Host ""
Write-Host ("Status Code: " + $response.StatusCode)
Write-Host ("Final URL: " + $response.BaseResponse.ResponseUri.AbsoluteUri)

if ($response.BaseResponse.ResponseUri.AbsoluteUri -match "script.googleusercontent.com/macros/echo") {
    Write-Host ""
    Write-Host "Redirected to Google ECHO endpoint - doPost() was NOT called"
} else {
    Write-Host ""
    Write-Host "Web App endpoint reached - doPost() SHOULD have fired"
}

Write-Host ""
Write-Host "Response Body:"
Write-Host $response.Content

Write-Host ""
Write-Host "=== Test Complete ==="
