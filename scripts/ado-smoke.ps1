param(
  [string]$BaseUrl = "http://localhost:3050",
  [string]$TeamName = "Dubai Team",
  [string]$SprintName = "Sprint 1",
  [switch]$SkipTeamSetup,
  [switch]$SkipProvision
)

$ErrorActionPreference = 'Stop'

function Invoke-Json([string]$Method, [string]$Url, $Body = $null) {
  try {
    if ($null -ne $Body) {
      $jsonBody = $Body | ConvertTo-Json -Depth 16
      return Invoke-RestMethod -Uri $Url -Method $Method -ContentType 'application/json' -Body $jsonBody
    }
    return Invoke-RestMethod -Uri $Url -Method $Method
  } catch {
    $msg = $_.Exception.Message
    throw "Request failed: $Method $Url :: $msg"
  }
}

try {
  Write-Output "GET $BaseUrl/api/ado-config"
  $cfg = Invoke-Json -Method 'GET' -Url "$BaseUrl/api/ado-config"
  if (-not $cfg.organization -or -not $cfg.project -or -not $cfg.isPATSet) {
    throw 'ADO config is missing organization/project/PAT'
  }

  $provision = $null

  if (-not $SkipTeamSetup.IsPresent) {
    Write-Output "POST $BaseUrl/api/team-setup"
    $null = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/team-setup"
  }

  if (-not $SkipProvision.IsPresent) {
    Write-Output "POST $BaseUrl/api/ado-provision"
    $provision = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/ado-provision" -Body @{ userEmails = @() }
  }

  $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
  $epicTitle = "Smoke Epic $ts"
  $featureTitle = "Smoke Feature $ts"
  $storyTitle = "Smoke Story $ts"

  Write-Output "POST $BaseUrl/api/create-ado-backlog"
  $create = Invoke-Json -Method 'POST' -Url "$BaseUrl/api/create-ado-backlog" -Body @{
    brId = "BR-SMOKE-$ts"
    teamName = $TeamName
    sprintName = $SprintName
    backlog = @{
      epics = @(
        @{
          title = $epicTitle
          description = 'Smoke test epic for ADO hierarchy validation.'
          businessValue = 80
          effort = 13
        }
      )
      features = @(
        @{
          title = $featureTitle
          description = 'Smoke test feature linked to epic.'
          epic = $epicTitle
          priority = 1
        }
      )
      userStories = @(
        @{
          title = $storyTitle
          userStory = 'As a PM, I need hierarchy traceability in ADO.'
          feature = $featureTitle
          points = 5
          acceptanceCriteria = @(
            'Hierarchy links are present in ADO.'
            'Story has sprint assignment and task children for burndown.'
          )
        }
      )
    }
  }

  if (-not $create.success) {
    throw 'ADO backlog creation did not return success=true'
  }

  if (($create.summary.epicsCreated -lt 1) -or ($create.summary.featuresCreated -lt 1) -or ($create.summary.userStoriesCreated -lt 1)) {
    throw "Expected Epic/Feature/Story creation. Summary: $($create.summary | ConvertTo-Json -Compress) Errors: $($create.results.errors | ConvertTo-Json -Compress) Metadata: $($create.metadata | ConvertTo-Json -Compress)"
  }

  if (($create.summary.tasksCreated -lt 1)) {
    throw "Expected at least 1 Task child for burndown. Summary: $($create.summary | ConvertTo-Json -Compress)"
  }

  [PSCustomObject]@{
    organization = $cfg.organization
    project = $cfg.project
    team = $TeamName
    sprint = $SprintName
    typeMapping = $create.metadata.typeMapping
    iterationPath = $create.metadata.iterationPath
    burndownReady = $create.metadata.burndownReady
    summary = $create.summary
    createdIds = [PSCustomObject]@{
      epic = $create.results.epics[0].id
      feature = $create.results.features[0].id
      story = $create.results.userStories[0].id
      task = $create.results.tasks[0].id
    }
    createWarnings = @($create.results.warnings).Count
    provisionWarnings = if ($provision) { @($provision.report.warnings).Count } else { 0 }
  } | ConvertTo-Json -Depth 12
}
catch {
  Write-Error $_
  exit 1
}

exit 0