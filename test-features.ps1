$ErrorActionPreference = "Continue"
$BASE = "http://localhost:3001/api/v1"
$pass = 0; $fail = 0

function Test-Endpoint($label, $block) {
    try {
        $result = & $block
        Write-Host "  [PASS] $label" -ForegroundColor Green
        $script:pass++
        return $result
    } catch {
        $errMsg = $_.ErrorDetails.Message
        if (-not $errMsg) { $errMsg = $_.Exception.Message }
        Write-Host "  [FAIL] $label - $errMsg" -ForegroundColor Red
        $script:fail++
        return $null
    }
}

# ============================================================
Write-Host "`n=== AUTH ===" -ForegroundColor Cyan
$body = @{usernameOrEmail = "admin@dataplatform.com"; password = "Admin@123456"} | ConvertTo-Json
$lr = Invoke-RestMethod -Uri "$BASE/auth/login" -Method Post -Body $body -ContentType "application/json"
$tok = $lr.accessToken
$hdrs = @{Authorization = "Bearer $tok"; "Content-Type" = "application/json"}
$hdrsNoJson = @{Authorization = "Bearer $tok"}
Write-Host "  Login OK" -ForegroundColor Green

$assets = Invoke-RestMethod -Uri "$BASE/assets?page=1&limit=5" -Headers $hdrsNoJson
$aid = $assets.data[0].id
$aid2 = $assets.data[1].id
$uid = $lr.user.id
Write-Host "  Asset1: $aid | Asset2: $aid2 | UserId: $uid" -ForegroundColor DarkGray

# ============================================================
Write-Host "`n=== VERSION HISTORY ===" -ForegroundColor Cyan

$history = Test-Endpoint "GET /assets/:id/history" {
    $r = Invoke-RestMethod -Uri "$BASE/assets/$aid/history" -Headers $hdrsNoJson
    if ($r.history.Count -eq 0) { throw "empty history" }
    Write-Host "    -> $($r.history.Count) versions (latest: v$($r.history[0].version), changeType=$($r.history[0].changeType))" -ForegroundColor DarkGray
    $r
}

Test-Endpoint "GET /assets/:id/versions/:v1/compare/:v2" {
    $v1 = $history.history[-1].version; $v2 = $history.history[0].version
    $r = Invoke-RestMethod -Uri "$BASE/assets/$aid/versions/$v1/compare/$v2" -Headers $hdrsNoJson
    if ($null -eq $r.changes -and $null -eq $r.comparison) { throw "unexpected response shape" }
    Write-Host "    -> changes array present, count=$($r.comparison.changes.Count)" -ForegroundColor DarkGray
}

Test-Endpoint "POST /assets/:id/versions/:version/restore" {
    $v = $history.history[-1].version
    $r = Invoke-RestMethod -Uri "$BASE/assets/$aid/versions/$v/restore" -Method Post -Headers $hdrs
    if (-not $r.asset.id) { throw "no asset in response" }
    Write-Host "    -> restored to v$($r.asset.version)" -ForegroundColor DarkGray
}

# ============================================================
Write-Host "`n=== RELATIONSHIPS ===" -ForegroundColor Cyan

$relBody = @{sourceAssetId=$aid; targetAssetId=$aid2; relationshipType="DERIVED_FROM"} | ConvertTo-Json
$newRel = Test-Endpoint "POST /relationships (create)" {
    $r = Invoke-RestMethod -Uri "$BASE/relationships" -Method Post -Body $relBody -Headers $hdrs
    if (-not $r.relationship.id) { throw "no id" }
    Write-Host "    -> id=$($r.relationship.id) type=$($r.relationship.relationshipType)" -ForegroundColor DarkGray
    $r.relationship
}

Test-Endpoint "GET /relationships/:id (single)" {
    $r = Invoke-RestMethod -Uri "$BASE/relationships/$($newRel.id)" -Headers $hdrsNoJson
    if (-not $r.relationship.id) { throw "no id" }
}

Test-Endpoint "GET /relationships/asset/:id (list)" {
    $r = Invoke-RestMethod -Uri "$BASE/relationships/asset/$aid" -Headers $hdrsNoJson
    Write-Host "    -> $($r.relationships.Count) relationships" -ForegroundColor DarkGray
}

Test-Endpoint "GET /relationships/asset/:id/summary" {
    Invoke-RestMethod -Uri "$BASE/relationships/asset/$aid/summary" -Headers $hdrsNoJson | Out-Null
}

Test-Endpoint "DELETE /relationships/:id" {
    Invoke-RestMethod -Uri "$BASE/relationships/$($newRel.id)" -Method Delete -Headers $hdrsNoJson | Out-Null
    $after = Invoke-RestMethod -Uri "$BASE/relationships/asset/$aid" -Headers $hdrsNoJson
    Write-Host "    -> after delete count=$($after.relationships.Count)" -ForegroundColor DarkGray
}

# ============================================================
Write-Host "`n=== QUALITY RULES ===" -ForegroundColor Cyan

Test-Endpoint "GET /quality/overview" {
    $r = Invoke-RestMethod -Uri "$BASE/quality/overview" -Headers $hdrsNoJson
    Write-Host "    -> score=$($r.overallScore)% total=$($r.totalRules) pass=$($r.passedRules) fail=$($r.failedRules)" -ForegroundColor DarkGray
}

$ruleBody = @{assetId=$aid; name="Test COMPLETENESS Rule"; ruleType="COMPLETENESS"; ruleDefinition=@{column="id"; threshold=0.9}; severity="CRITICAL"} | ConvertTo-Json -Depth 3

$newRule = Test-Endpoint "POST /quality/rules (create)" {
    $r = Invoke-RestMethod -Uri "$BASE/quality/rules" -Method Post -Body $ruleBody -Headers $hdrs
    if (-not $r.rule.id) { throw "no id" }
    Write-Host "    -> id=$($r.rule.id)" -ForegroundColor DarkGray
    $r.rule
}

Test-Endpoint "GET /quality/rules/:id" {
    $r = Invoke-RestMethod -Uri "$BASE/quality/rules/$($newRule.id)" -Headers $hdrsNoJson
    if (-not $r.rule.id) { throw "no id" }
}

Test-Endpoint "PUT /quality/rules/:id (update)" {
    $upd = @{name="Updated COMPLETENESS Rule"; severity="WARNING"; ruleType="COMPLETENESS"; ruleDefinition=@{column="id"; threshold=0.95}} | ConvertTo-Json -Depth 3
    $r = Invoke-RestMethod -Uri "$BASE/quality/rules/$($newRule.id)" -Method Put -Body $upd -Headers $hdrs
    Write-Host "    -> severity=$($r.rule.severity)" -ForegroundColor DarkGray
}

Test-Endpoint "POST /quality/rules/:id/evaluate" {
    $r = Invoke-RestMethod -Uri "$BASE/quality/rules/$($newRule.id)/evaluate" -Method Post -Headers $hdrs
    Write-Host "    -> status=$($r.result.status) score=$($r.result.score)" -ForegroundColor DarkGray
}

Test-Endpoint "GET /quality/assets/:assetId/rules" {
    $r = Invoke-RestMethod -Uri "$BASE/quality/assets/$aid/rules" -Headers $hdrsNoJson
    Write-Host "    -> $($r.rules.Count) rules for asset" -ForegroundColor DarkGray
}

Test-Endpoint "GET /quality/assets/:assetId/status" {
    $r = Invoke-RestMethod -Uri "$BASE/quality/assets/$aid/status" -Headers $hdrsNoJson
    Write-Host "    -> status=$($r.status.overallStatus) passedRules=$($r.status.passedRules)" -ForegroundColor DarkGray
}

Test-Endpoint "POST /quality/assets/:assetId/evaluate (run all)" {
    $r = Invoke-RestMethod -Uri "$BASE/quality/assets/$aid/evaluate" -Method Post -Headers $hdrs
    Write-Host "    -> $($r.results.Count) results" -ForegroundColor DarkGray
}

Test-Endpoint "DELETE /quality/rules/:id" {
    Invoke-RestMethod -Uri "$BASE/quality/rules/$($newRule.id)" -Method Delete -Headers $hdrs | Out-Null
}

# ============================================================
Write-Host "`n=== NOTIFICATIONS ===" -ForegroundColor Cyan

$notifBody = @{userId=$uid; type="QUALITY_ALERT"; title="Test Alert"; message="This is a test notification"} | ConvertTo-Json
$newNotif = Test-Endpoint "POST /notifications (create)" {
    $r = Invoke-RestMethod -Uri "$BASE/notifications" -Method Post -Body $notifBody -Headers $hdrs
    if (-not $r.notification.id) { throw "no id" }
    Write-Host "    -> id=$($r.notification.id) type=$($r.notification.type)" -ForegroundColor DarkGray
    $r.notification
}

Test-Endpoint "GET /notifications (list)" {
    $r = Invoke-RestMethod -Uri "$BASE/notifications" -Headers $hdrsNoJson
    Write-Host "    -> total=$($r.total) unread=$($r.unreadCount)" -ForegroundColor DarkGray
}

Test-Endpoint "GET /notifications/unread-count" {
    $r = Invoke-RestMethod -Uri "$BASE/notifications/unread-count" -Headers $hdrsNoJson
    Write-Host "    -> count=$($r.count)" -ForegroundColor DarkGray
}

Test-Endpoint "PATCH /notifications/:id/read" {
    $r = Invoke-RestMethod -Uri "$BASE/notifications/$($newNotif.id)/read" -Method Patch -Headers $hdrs
    Write-Host "    -> isRead=$($r.notification.isRead)" -ForegroundColor DarkGray
}

# Create another one to test mark-all-read
$n2 = Invoke-RestMethod -Uri "$BASE/notifications" -Method Post -Body $notifBody -Headers $hdrs
Test-Endpoint "PATCH /notifications/read-all" {
    $r = Invoke-RestMethod -Uri "$BASE/notifications/read-all" -Method Patch -Headers $hdrs
    Write-Host "    -> marked $($r.count) as read" -ForegroundColor DarkGray
}

Test-Endpoint "DELETE /notifications/:id" {
    Invoke-RestMethod -Uri "$BASE/notifications/$($newNotif.id)" -Method Delete -Headers $hdrs | Out-Null
}

# ============================================================
Write-Host "`n=== GOVERNANCE WORKFLOWS ===" -ForegroundColor Cyan

$wfDef = @{steps=@(@{name="Review"; type="APPROVAL"}, @{name="Approve"; type="APPROVAL"})} 
$wfBody = @{name="Test Approval Workflow"; description="Created by test script"; definition=$wfDef} | ConvertTo-Json -Depth 5

$newWf = Test-Endpoint "POST /workflows (create)" {
    $r = Invoke-RestMethod -Uri "$BASE/workflows" -Method Post -Body $wfBody -Headers $hdrs
    if (-not $r.workflow.id) { throw "no id" }
    Write-Host "    -> id=$($r.workflow.id)" -ForegroundColor DarkGray
    $r.workflow
}

Test-Endpoint "GET /workflows (list)" {
    $r = Invoke-RestMethod -Uri "$BASE/workflows" -Headers $hdrsNoJson
    Write-Host "    -> total=$($r.total)" -ForegroundColor DarkGray
}

Test-Endpoint "GET /workflows/:id" {
    $r = Invoke-RestMethod -Uri "$BASE/workflows/$($newWf.id)" -Headers $hdrsNoJson
    if (-not $r.workflow.id) { throw "no id" }
    Write-Host "    -> name=$($r.workflow.name)" -ForegroundColor DarkGray
}

$newInst = Test-Endpoint "POST /workflows/:id/trigger" {
    $ctx = @{entityType="asset"; entityId=$aid} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE/workflows/$($newWf.id)/trigger" -Method Post -Body $ctx -Headers $hdrs
    if (-not $r.instance.id) { throw "no id" }
    Write-Host "    -> instanceId=$($r.instance.id) status=$($r.instance.status)" -ForegroundColor DarkGray
    $r.instance
}

Test-Endpoint "GET /workflows/instances/list" {
    $r = Invoke-RestMethod -Uri "$BASE/workflows/instances/list" -Headers $hdrsNoJson
    Write-Host "    -> total=$($r.total)" -ForegroundColor DarkGray
}

Test-Endpoint "GET /workflows/instances/:id" {
    $r = Invoke-RestMethod -Uri "$BASE/workflows/instances/$($newInst.id)" -Headers $hdrsNoJson
    if (-not $r.instance.id) { throw "no id" }
    Write-Host "    -> steps=$($r.instance.steps.Count)" -ForegroundColor DarkGray
    $r.instance
}

$stepId = (Invoke-RestMethod -Uri "$BASE/workflows/instances/$($newInst.id)" -Headers $hdrsNoJson).instance.steps[0].id
Test-Endpoint "POST /workflows/instances/:id/steps/:stepId/approve" {
    $approveBody = @{comment="Looks good"} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE/workflows/instances/$($newInst.id)/steps/$stepId/approve" -Method Post -Body $approveBody -Headers $hdrs
    Write-Host "    -> instance status=$($r.instance.status) currentStep=$($r.instance.currentStep)" -ForegroundColor DarkGray
}

Test-Endpoint "POST /workflows/instances/:id/cancel" {
    $r = Invoke-RestMethod -Uri "$BASE/workflows/instances/$($newInst.id)/cancel" -Method Post -Headers $hdrs
    Write-Host "    -> status=$($r.instance.status)" -ForegroundColor DarkGray
}

# ============================================================
Write-Host "`n============================================" -ForegroundColor White
Write-Host "  RESULTS: $pass PASSED, $fail FAILED" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
Write-Host "============================================`n" -ForegroundColor White
