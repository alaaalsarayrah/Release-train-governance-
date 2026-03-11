$ErrorActionPreference = "Stop"

$base = "http://localhost:4200/api/config"
$current = Invoke-RestMethod -Uri $base -Method Get

$freezes = @(
  [pscustomobject]@{ id = "pf-2026-q1-close"; title = "Q1 Close Freeze"; startDate = "2026-03-25"; endDate = "2026-03-31"; scope = "All production and replica changes"; active = $true },
  [pscustomobject]@{ id = "pf-2026-q2-close"; title = "Q2 Close Freeze"; startDate = "2026-06-25"; endDate = "2026-06-30"; scope = "All production and replica changes"; active = $true },
  [pscustomobject]@{ id = "pf-2026-q3-close"; title = "Q3 Close Freeze"; startDate = "2026-09-25"; endDate = "2026-09-30"; scope = "All production and replica changes"; active = $true },
  [pscustomobject]@{ id = "pf-2026-year-end"; title = "Year End Freeze"; startDate = "2026-12-20"; endDate = "2026-12-31"; scope = "All production and replica changes"; active = $true }
)

$envs = @($current.environments)

function Get-EnvId {
  param(
    [string]$pattern,
    [string]$fallback
  )

  $match = $envs | Where-Object { ("$($_.name) $($_.track)" -match $pattern) } | Select-Object -First 1
  if ($match -and $match.id) {
    return $match.id
  }

  return $fallback
}

$uatEnvs = @($envs | Where-Object { ("$($_.name) $($_.track)" -match "(?i)uat") } | Sort-Object name)
$uat1 = if ($uatEnvs.Count -ge 1) { $uatEnvs[0].id } else { "env-uat1" }
$uat2 = if ($uatEnvs.Count -ge 2) { $uatEnvs[1].id } else { $uat1 }
$uat3 = if ($uatEnvs.Count -ge 3) { $uatEnvs[2].id } else { $uat2 }
$replica = Get-EnvId "(?i)replica" "env-replica"
$production = Get-EnvId "(?i)production|prod" "env-production"

$sizeByName = @{}
foreach ($size in @($current.releaseSizes)) {
  $key = [string]$size.name
  if ($key) {
    $sizeByName[$key.ToLowerInvariant()] = [string]$size.id
  }
}

$sizeSmall = if ($sizeByName.ContainsKey("small")) { $sizeByName["small"] } else { "size-small" }
$sizeMedium = if ($sizeByName.ContainsKey("medium")) { $sizeByName["medium"] } else { "size-medium" }
$sizeLarge = if ($sizeByName.ContainsKey("large")) { $sizeByName["large"] } else { "size-large" }
$sizeVeryLarge = if ($sizeByName.ContainsKey("very large")) { $sizeByName["very large"] } else { "size-very-large" }

function New-Train {
  param(
    [string]$id,
    [string]$name,
    [string]$targetRelease,
    [string]$startDate,
    [string]$endDate,
    [string]$envId,
    [string[]]$releaseSizeIds,
    [string]$status = "Planning",
    [string]$lifecycleType = "",
    [string]$sourceReleaseTrainId = "",
    [string]$sourceReplicaReleaseTrainId = ""
  )

  return [pscustomobject]@{
    id = $id
    name = $name
    targetRelease = $targetRelease
    startDate = $startDate
    endDate = $endDate
    targetEnvironmentId = $envId
    status = $status
    lifecycleType = $lifecycleType
    sourceReleaseTrainId = $sourceReleaseTrainId
    sourceReplicaReleaseTrainId = $sourceReplicaReleaseTrainId
    releaseSizeIds = $releaseSizeIds
    scopeRecords = @()
  }
}

function New-Version {
  param(
    [string]$month,
    [int]$week
  )

  $m = [int]$month
  return "26.$m.$week"
}

function Parse-Date {
  param([string]$value)
  return [datetime]::ParseExact($value, "yyyy-MM-dd", $null)
}

function Format-Date {
  param([datetime]$value)
  return $value.ToString("yyyy-MM-dd")
}

function Add-Days {
  param(
    [datetime]$value,
    [int]$days
  )

  return $value.AddDays($days)
}

function Get-Later-Date {
  param(
    [datetime]$a,
    [datetime]$b
  )

  if ($a -ge $b) { return $a }
  return $b
}

function Has-Environment-Overlap {
  param(
    [datetime]$start,
    [datetime]$end,
    [array]$trains,
    [string]$environmentId
  )

  foreach ($train in $trains) {
    if ($train.targetEnvironmentId -ne $environmentId) { continue }

    $trainStart = Parse-Date $train.startDate
    $trainEnd = Parse-Date $train.endDate

    if ($start -le $trainEnd -and $end -ge $trainStart) {
      return $true
    }
  }

  return $false
}

function Find-Retrofit-Placement {
  param(
    [datetime]$baseDate,
    [array]$trains,
    [string]$sourceEnvironmentId,
    [string[]]$preferredTargetEnvironmentIds
  )

  foreach ($targetEnvironmentId in $preferredTargetEnvironmentIds) {
    if ($targetEnvironmentId -eq $sourceEnvironmentId) { continue }

    for ($offset = 0; $offset -lt 120; $offset += 1) {
      $start = Add-Days $baseDate $offset
      $end = Add-Days $start 6

      if (-not (Has-Environment-Overlap -start $start -end $end -trains $trains -environmentId $targetEnvironmentId)) {
        return [pscustomobject]@{
          targetEnvironmentId = $targetEnvironmentId
          startDate = Format-Date $start
          endDate = Format-Date $end
        }
      }
    }
  }

  return $null
}

$months = @(
  [pscustomobject]@{ code = "03"; reps = "2026-03-16"; repe = "2026-03-19"; prods = "2026-03-22"; prode = "2026-03-22"; xl = $false },
  [pscustomobject]@{ code = "04"; reps = "2026-04-20"; repe = "2026-04-23"; prods = "2026-04-26"; prode = "2026-04-26"; xl = $true },
  [pscustomobject]@{ code = "05"; reps = "2026-05-18"; repe = "2026-05-21"; prods = "2026-05-24"; prode = "2026-05-24"; xl = $false },
  [pscustomobject]@{ code = "06"; reps = "2026-06-15"; repe = "2026-06-18"; prods = "2026-06-21"; prode = "2026-06-21"; xl = $true },
  [pscustomobject]@{ code = "07"; reps = "2026-07-20"; repe = "2026-07-23"; prods = "2026-07-26"; prode = "2026-07-26"; xl = $false },
  [pscustomobject]@{ code = "08"; reps = "2026-08-17"; repe = "2026-08-20"; prods = "2026-08-23"; prode = "2026-08-23"; xl = $true },
  [pscustomobject]@{ code = "09"; reps = "2026-09-14"; repe = "2026-09-17"; prods = "2026-09-20"; prode = "2026-09-20"; xl = $false },
  [pscustomobject]@{ code = "10"; reps = "2026-10-19"; repe = "2026-10-22"; prods = "2026-10-25"; prode = "2026-10-25"; xl = $true },
  [pscustomobject]@{ code = "11"; reps = "2026-11-16"; repe = "2026-11-19"; prods = "2026-11-22"; prode = "2026-11-22"; xl = $false },
  [pscustomobject]@{ code = "12"; reps = "2026-12-14"; repe = "2026-12-17"; prods = "2026-12-18"; prode = "2026-12-18"; xl = $true }
)

$trains = @()
$monthRefs = @()
foreach ($m in $months) {
  $release = New-Version $m.code 1

  $uat1Id = "rt-$($m.code)-uat1"
  $uat2Id = "rt-$($m.code)-uat2"
  $uat3Id = "rt-$($m.code)-uat3"
  $replicaId = "rt-$($m.code)-replica"
  $prodId = "rt-$($m.code)-production"
  $largeOrXL = if ($m.xl) { @($sizeVeryLarge, $sizeMedium) } else { @($sizeLarge, $sizeMedium) }
  $uat3EndDate = if ($m.xl) { "2026-$($m.code)-28" } else { "2026-$($m.code)-21" }

  $trains += New-Train $uat1Id "Release Train $release UAT1" $release "2026-$($m.code)-01" "2026-$($m.code)-07" $uat1 @($sizeSmall) "Planning"
  $trains += New-Train $uat2Id "Release Train $release UAT2" $release "2026-$($m.code)-01" "2026-$($m.code)-14" $uat2 @($sizeSmall, $sizeMedium) "Signed Off"
  $trains += New-Train $uat3Id "Release Train $release UAT3" $release "2026-$($m.code)-01" $uat3EndDate $uat3 $largeOrXL "Scope Freeze"

  $trains += New-Train $replicaId "Release Train $release Replica" $release $m.reps $m.repe $replica @($sizeMedium) "Planning" "" $uat2Id ""
  $trains += New-Train $prodId "Release Train $release Production" $release $m.prods $m.prode $production @($sizeMedium) "Planning" "" "" $replicaId

  $monthRefs += [pscustomobject]@{
    code = $m.code
    release = $release
    uat1Id = $uat1Id
    uat2Id = $uat2Id
    uat3Id = $uat3Id
    replicaId = $replicaId
  }
}

foreach ($ref in $monthRefs) {
  $sourceSpecs = @(
    [pscustomobject]@{ sourceId = $ref.uat1Id; suffix = "1"; preferredTargets = @($uat2, $uat3); linkReplica = $false },
    [pscustomobject]@{ sourceId = $ref.uat2Id; suffix = "2"; preferredTargets = @($uat1, $uat3); linkReplica = $true; replicaId = $ref.replicaId },
    [pscustomobject]@{ sourceId = $ref.uat3Id; suffix = "3"; preferredTargets = @($uat2, $uat1); linkReplica = $false }
  )

  foreach ($spec in $sourceSpecs) {
    $sourceTrain = $trains | Where-Object { $_.id -eq $spec.sourceId } | Select-Object -First 1
    if (-not $sourceTrain) { continue }

    $baseDate = Add-Days (Parse-Date $sourceTrain.endDate) 1
    $sourceReplicaReleaseTrainId = ""

    if ($spec.linkReplica) {
      $replicaTrain = $trains | Where-Object { $_.id -eq $spec.replicaId } | Select-Object -First 1
      if ($replicaTrain) {
        $afterReplica = Add-Days (Parse-Date $replicaTrain.endDate) 1
        $baseDate = Get-Later-Date -a $baseDate -b $afterReplica
        $sourceReplicaReleaseTrainId = $replicaTrain.id
      }
    }

    $placement = Find-Retrofit-Placement -baseDate $baseDate -trains $trains -sourceEnvironmentId $sourceTrain.targetEnvironmentId -preferredTargetEnvironmentIds $spec.preferredTargets
    if (-not $placement) {
      throw "Unable to find retrofit slot for $($sourceTrain.id)."
    }

    $retrofitId = "rt-$($ref.code)-retrofit-$($spec.suffix)"
    $retrofitTrain = New-Train $retrofitId "Retrofit $($ref.release) UAT$($spec.suffix)" "retrofit-$($ref.release)" $placement.startDate $placement.endDate $placement.targetEnvironmentId @($sizeSmall) "Planning" "retrofit" $sourceTrain.id $sourceReplicaReleaseTrainId
    $retrofitTrain | Add-Member -NotePropertyName "retrofitSourceReleaseTrainId" -NotePropertyValue $sourceTrain.id -Force

    $sourceTrain | Add-Member -NotePropertyName "retrofitReleaseTrainId" -NotePropertyValue $retrofitId -Force

    $trains += $retrofitTrain
  }
}

# Phase 1: create freeze periods first and clear trains.
$phase1 = $current | ConvertTo-Json -Depth 100 | ConvertFrom-Json
$phase1.productionFreezes = $freezes
$phase1.releaseTrains = @()
$body1 = @{ mode = "replace"; config = $phase1 } | ConvertTo-Json -Depth 100
Invoke-RestMethod -Uri $base -Method Put -ContentType "application/json" -Body $body1 | Out-Null

# Phase 2: insert new release trains for all environments from March to year-end.
$phase2 = $phase1 | ConvertTo-Json -Depth 100 | ConvertFrom-Json
$phase2.releaseTrains = $trains
$body2 = @{ mode = "replace"; config = $phase2 } | ConvertTo-Json -Depth 100
Invoke-RestMethod -Uri $base -Method Put -ContentType "application/json" -Body $body2 | Out-Null

Write-Output "done: freezes=$($freezes.Count), trains=$($trains.Count), uat2=$uat2"
