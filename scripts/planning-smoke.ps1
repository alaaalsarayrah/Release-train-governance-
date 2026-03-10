param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ScenarioKey = "backlog-refinement",
  [switch]$RunAgent
)

$ErrorActionPreference = 'Stop'

$results = @()
function Add-Result([string]$Step, [bool]$Ok, [string]$Detail) {
  $script:results += [PSCustomObject]@{
    step = $Step
    ok = $Ok
    detail = $Detail
  }
}

function Read-ErrorBody($Exception) {
  try {
    if ($Exception.Response -and $Exception.Response.GetResponseStream()) {
      $reader = New-Object System.IO.StreamReader($Exception.Response.GetResponseStream())
      return $reader.ReadToEnd()
    }
  } catch {
    return ""
  }
  return ""
}

function Invoke-Json([string]$Method, [string]$Url, $Body = $null) {
  try {
    if ($null -ne $Body) {
      $jsonBody = $Body | ConvertTo-Json -Depth 12
      return Invoke-RestMethod -Uri $Url -Method $Method -ContentType 'application/json' -Body $jsonBody
    }
    return Invoke-RestMethod -Uri $Url -Method $Method
  } catch {
    $body = Read-ErrorBody $_.Exception
    $message = $_.Exception.Message
    if ($body) {
      throw "$message | body=$body"
    }
    throw $message
  }
}

$sessionId = ""

try {
  $backlog = Invoke-Json -Method 'GET' -Url "$BaseUrl/api/planning/backlog?source=local"
  Add-Result -Step 'backlog' -Ok $true -Detail ("items=" + @($backlog.items).Count)

  $sessionPayload = @{
    title = "Planning Smoke Session"
    teamId = "TEAM-SMOKE"
    teamName = "Smoke Team"
    sprintId = "SPRINT-SMOKE"
    sprintName = "Sprint Smoke"
    runAgents = $false
    selectedAgents = @('product_owner_assistant', 'estimation_advisor')
    planningContext = @{
      backlogItems = @(
        @{ id = 'US-SMOKE-1'; title = 'Login hardening'; businessValue = 8 },
        @{ id = 'US-SMOKE-2'; title = 'Risk dashboard'; businessValue = 9 }
      )
      teamCapacity = 30
      capacityPoints = 30
    }
  }

  $session = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/planning/session" -Body $sessionPayload
  $sessionId = $session.sessionId
  if (-not $sessionId) { throw 'sessionId missing from create-session response' }
  Add-Result -Step 'create-session' -Ok $true -Detail "sessionId=$sessionId"

  if ($RunAgent.IsPresent) {
    $runAgentPayload = @{ sessionId = $sessionId; agentKey = 'product_owner_assistant' }
    $runAgent = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/planning/run-agent" -Body $runAgentPayload
    Add-Result -Step 'run-agent' -Ok $true -Detail ("modelUsed=" + $runAgent.output.model_used)
  }

  $depsPayload = @{
    sessionId = $sessionId
    records = @(
      @{
        source_item = 'US-SMOKE-1'
        target_item = 'US-SMOKE-2'
        dependency_type = 'Blocks'
        severity = 'High'
        mitigation = 'Sequence US-SMOKE-1 before US-SMOKE-2'
      }
    )
  }
  $null = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/planning/dependencies" -Body $depsPayload
  Add-Result -Step 'dependencies' -Ok $true -Detail 'saved=1'

  $estPayload = @{
    sessionId = $sessionId
    decisions = @(
      @{
        backlog_item_id = 'US-SMOKE-1'
        backlog_item_title = 'Login hardening'
        ai_estimate = 5
        final_estimate = 8
        confidence = 0.72
        assumptions = @('legacy auth module')
      }
    )
  }
  $null = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/planning/estimation" -Body $estPayload
  Add-Result -Step 'estimation' -Ok $true -Detail 'saved=1'

  $archPayload = @{
    sessionId = $sessionId
    note = @{
      impacted_components = @('API', 'Auth')
      technical_enablers = @('Token rotation')
      recommended_actions = @('Add regression tests')
    }
  }
  $null = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/planning/architecture" -Body $archPayload
  Add-Result -Step 'architecture' -Ok $true -Detail 'saved=1'

  $riskPayload = @{
    sessionId = $sessionId
    records = @(
      @{
        risk_id = 'R-SMOKE-1'
        title = 'Auth regression'
        severity = 'High'
        mitigation = 'Add canary rollout'
        owner = 'Tech Lead'
        status = 'Open'
      }
    )
  }
  $null = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/planning/risks" -Body $riskPayload
  Add-Result -Step 'risks' -Ok $true -Detail 'saved=1'

  $decisionPayload = @{
    sessionId = $sessionId
    agentKey = 'estimation_advisor'
    decision = 'modify'
    finalOutput = @{ summary = 'Human adjusted estimate due to legacy complexity' }
    humanRationale = 'Legacy auth complexity'
  }
  $null = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/planning/decision" -Body $decisionPayload
  Add-Result -Step 'decision' -Ok $true -Detail 'saved=1'

  $finalizePayload = @{ sessionId = $sessionId }
  $final = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/planning/finalize" -Body $finalizePayload
  Add-Result -Step 'finalize' -Ok $true -Detail ("status=" + $final.session.status)

  $summaryExport = Invoke-Json -Method 'GET' -Url "$BaseUrl/api/planning/export?type=summary&format=json&sessionId=$sessionId"
  Add-Result -Step 'export-summary-json' -Ok $true -Detail ("type=" + $summaryExport.type)

  $riskCsv = Invoke-WebRequest -Uri "$BaseUrl/api/planning/export?type=risks&format=csv&sessionId=$sessionId" -Method Get -UseBasicParsing
  Add-Result -Step 'export-risks-csv' -Ok $true -Detail ("bytes=" + $riskCsv.RawContentLength)

  $startScenario = @{
    action = 'start'
    scenarioKey = $ScenarioKey
  }
  $run = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/evaluation/scenario-runner" -Body $startScenario
  if (-not $run.runId) { throw 'runId missing from scenario start response' }
  Add-Result -Step 'scenario-start' -Ok $true -Detail ("runId=" + $run.runId)

  $interactionPayload = @{
    action = 'interaction'
    runId = $run.runId
    recommendationId = 'REC-SMOKE-1'
    interactionAction = 'accept'
    notes = 'Accepted recommendation'
  }
  $null = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/evaluation/scenario-runner" -Body $interactionPayload
  Add-Result -Step 'scenario-interaction' -Ok $true -Detail 'saved=1'

  $completePayload = @{
    action = 'complete'
    runId = $run.runId
    durationSeconds = 12
    recommendationsShown = 3
    acceptedCount = 2
    modifiedCount = 1
    rejectedCount = 0
    clarificationRequests = 0
    perceivedUsefulness = 4
    easeOfUse = 4
    trust = 4
    intentionToUse = 4
    notes = 'planning smoke'
  }
  $null = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/evaluation/scenario-runner" -Body $completePayload
  Add-Result -Step 'scenario-complete' -Ok $true -Detail 'ok'

  $scenarioSummary = Invoke-Json -Method 'GET' -Url "$BaseUrl/api/evaluation/scenario-runner"
  Add-Result -Step 'scenario-summary' -Ok $true -Detail ("totalRuns=" + $scenarioSummary.participantSummary.totalRuns)

  $evalExport = Invoke-Json -Method 'GET' -Url "$BaseUrl/api/planning/export?type=evaluation-metrics&format=json"
  Add-Result -Step 'export-evaluation-json' -Ok $true -Detail ("runs=" + @($evalExport.runs).Count)
}
catch {
  Add-Result -Step 'fatal' -Ok $false -Detail ("" + $_)
}

$results | ConvertTo-Json -Depth 6

if ($results.Where({ -not $_.ok }).Count -gt 0) {
  exit 1
}

exit 0
