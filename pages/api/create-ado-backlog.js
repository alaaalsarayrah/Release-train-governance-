import fs from 'fs'
import path from 'path'
import * as azdev from 'azure-devops-node-api'
import { resolveStrictTypeMapping, toTypeSet } from '../../lib/ado/work-item-types'
import {
  isAssigneeError,
  removeAssignedToPatch,
  resolveAssigneeCandidatesForAdo
} from '../../lib/ado/assignment'

const configPath = path.join(process.cwd(), 'public', '.ado-config.json')

function loadConfig() {
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(data)
  }
  return {}
}

function getAuthHeader(pat) {
  const token = Buffer.from(`:${pat}`).toString('base64')
  return `Basic ${token}`
}

async function adoRequest({ org, pat, apiPath, method = 'GET', body, contentType = 'application/json' }) {
  const url = `https://dev.azure.com/${org}${apiPath}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: getAuthHeader(pat),
      'Content-Type': contentType
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  if (!res.ok) {
    const message = json?.message || json?.raw || `ADO request failed (${res.status})`
    throw new Error(message)
  }

  return json
}

function flattenClassificationNodes(node, out = new Map()) {
  if (!node) return out
  if (node.path) out.set(node.path.toLowerCase(), node.path)
  for (const child of node.children || []) {
    flattenClassificationNodes(child, out)
  }
  return out
}

function flattenIterations(node, out = new Map()) {
  return flattenClassificationNodes(node, out)
}

function flattenAreas(node, out = new Map()) {
  return flattenClassificationNodes(node, out)
}

function normalizeIterationPathForWorkItem(rawPath, project) {
  if (!rawPath) return null
  let normalized = String(rawPath).replace(/^\\/, '')
  const iterationPrefix = `${project}\\Iteration\\`
  if (normalized.toLowerCase().startsWith(iterationPrefix.toLowerCase())) {
    normalized = `${project}\\${normalized.slice(iterationPrefix.length)}`
  }
  return normalized
}

async function resolveIterationPath({ org, project, pat, teamName, sprintName }) {
  if (!teamName && !sprintName) return null

  const root = await adoRequest({
    org,
    pat,
    apiPath: `/${encodeURIComponent(project)}/_apis/wit/classificationnodes/Iterations?$depth=7&api-version=7.1`
  })
  const all = flattenIterations(root)

  const candidates = []
  if (teamName && sprintName) {
    candidates.push(`\\${project}\\${teamName}\\${sprintName}`)
    candidates.push(`\\${project}\\Iteration\\${teamName}\\${sprintName}`)
  }
  if (sprintName) {
    candidates.push(`\\${project}\\${sprintName}`)
    candidates.push(`\\${project}\\Iteration\\${sprintName}`)
  }

  for (const candidate of candidates) {
    const found = all.get(candidate.toLowerCase())
    if (found) return normalizeIterationPathForWorkItem(found, project)
  }

  return null
}

function normalizeAreaPathForWorkItem(rawPath, project) {
  if (!rawPath) return project
  return String(rawPath).replace(/^\\/, '')
}

async function resolveAreaPath({ org, project, pat, artName, teamName }) {
  const root = await adoRequest({
    org,
    pat,
    apiPath: `/${encodeURIComponent(project)}/_apis/wit/classificationnodes/Areas?$depth=7&api-version=7.1`
  })
  const all = flattenAreas(root)

  const cleanArt = String(artName || '').trim()
  const cleanTeam = String(teamName || '').trim()

  const candidates = [
    cleanArt && cleanTeam ? `\\${project}\\${cleanArt}\\${cleanTeam}` : null,
    cleanArt ? `\\${project}\\${cleanArt}` : null,
    cleanTeam ? `\\${project}\\${cleanTeam}` : null,
    `\\${project}`
  ].filter(Boolean)

  for (const candidate of candidates) {
    const found = all.get(candidate.toLowerCase())
    if (found) return normalizeAreaPathForWorkItem(found, project)
  }

  return project
}

async function getSupportedWorkItemTypes(witApi, project) {
  const types = await witApi.getWorkItemTypes(project)
  return toTypeSet(types)
}

function buildPatch({
  title,
  description,
  tags,
  areaPath,
  iterationPath,
  assignedTo,
  acceptanceCriteria,
  businessValue,
  effort,
  points,
  priority
}) {
  const patch = [{ op: 'add', path: '/fields/System.Title', value: title }]

  if (description) {
    patch.push({ op: 'add', path: '/fields/System.Description', value: description })
  }

  if (tags) {
    patch.push({ op: 'add', path: '/fields/System.Tags', value: tags })
  }

  if (areaPath) {
    patch.push({ op: 'add', path: '/fields/System.AreaPath', value: areaPath })
  }

  if (iterationPath) {
    patch.push({ op: 'add', path: '/fields/System.IterationPath', value: iterationPath })
  }

  if (assignedTo) {
    patch.push({ op: 'add', path: '/fields/System.AssignedTo', value: assignedTo })
  }

  if (acceptanceCriteria) {
    patch.push({
      op: 'add',
      path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
      value: acceptanceCriteria
    })
  }

  if (businessValue !== undefined && businessValue !== null && businessValue !== '') {
    patch.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.BusinessValue', value: Number(businessValue) || 0 })
  }

  if (effort !== undefined && effort !== null && effort !== '') {
    patch.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.Effort', value: Number(effort) || 0 })
  }

  if (points !== undefined && points !== null && points !== '') {
    patch.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints', value: Number(points) || 0 })
  }

  if (priority) {
    const normalizedPriority = (() => {
      if (Number.isFinite(Number(priority))) return Number(priority)
      const text = String(priority).toLowerCase()
      if (text.includes('high') || text === 'h') return 1
      if (text.includes('low') || text === 'l') return 3
      return 2
    })()
    patch.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: normalizedPriority })
  }

  return patch
}

function extractAssignedTo(workItem) {
  const value = workItem?.fields?.['System.AssignedTo']
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    return value.displayName || value.uniqueName || value.descriptor || null
  }
  return null
}

function isInvalidFieldError(error) {
  const msg = String(error || '').toLowerCase()
  return (
    (msg.includes('field') && (msg.includes('not found') || msg.includes('is invalid') || msg.includes('does not exist'))) ||
    (msg.includes('system.iterationpath') && msg.includes('invalid tree name'))
  )
}

function pickFieldFromError(error, currentPatch, optionalFields) {
  const msg = String(error || '').toLowerCase()
  const aliases = {
    '/fields/Microsoft.VSTS.Common.AcceptanceCriteria': ['acceptancecriteria'],
    '/fields/Microsoft.VSTS.Common.BusinessValue': ['businessvalue'],
    '/fields/Microsoft.VSTS.Scheduling.Effort': ['effort'],
    '/fields/Microsoft.VSTS.Scheduling.StoryPoints': ['storypoints'],
    '/fields/Microsoft.VSTS.Common.Priority': ['priority'],
    '/fields/System.IterationPath': ['iterationpath', 'invalid tree name'],
    '/fields/System.AreaPath': ['areapath'],
    '/fields/System.AssignedTo': ['assignedto', 'assigned to', 'identity']
  }

  for (const path of optionalFields) {
    if (!currentPatch.some((x) => x.path === path)) continue
    const pathAliases = aliases[path] || []
    if (pathAliases.some((token) => msg.includes(token))) {
      return path
    }
  }

  return null
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase()
}

function getAssignedToFromPatch(patch) {
  const entry = (patch || []).find((x) => x?.path === '/fields/System.AssignedTo')
  return entry?.value ? String(entry.value).trim() : null
}

function setAssignedToPatch(patch, assignee) {
  const clean = String(assignee || '').trim()
  if (!clean) return patch

  let replaced = false
  const next = (patch || []).map((entry) => {
    if (entry?.path !== '/fields/System.AssignedTo') return entry
    replaced = true
    return { ...entry, value: clean }
  })

  if (!replaced) {
    next.push({ op: 'add', path: '/fields/System.AssignedTo', value: clean })
  }

  return next
}

function normalizeIdentityKey(value) {
  return String(value || '').trim().toLowerCase()
}

function uniqueAssignees(values) {
  const seen = new Set()
  const ordered = []

  for (const value of values || []) {
    const clean = String(value || '').trim()
    if (!clean) continue
    const key = normalizeIdentityKey(clean)
    if (seen.has(key)) continue
    seen.add(key)
    ordered.push(clean)
  }

  return ordered
}

function createRoundRobinAllocator(candidates) {
  const pool = uniqueAssignees(candidates)
  let index = 0

  return {
    pool,
    primary: pool[0] || null,
    next() {
      if (!pool.length) return null
      const assignee = pool[index % pool.length]
      index += 1
      return assignee
    },
    orderedCandidates(primaryAssignee) {
      return uniqueAssignees([primaryAssignee, ...pool])
    }
  }
}

async function createWithFallbackFields({ witApi, project, workItemType, patch, assigneeCandidates = [] }) {
  const optionalFields = [
    '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
    '/fields/Microsoft.VSTS.Common.BusinessValue',
    '/fields/Microsoft.VSTS.Scheduling.Effort',
    '/fields/Microsoft.VSTS.Scheduling.StoryPoints',
    '/fields/Microsoft.VSTS.Common.Priority',
    '/fields/System.IterationPath',
    '/fields/System.AreaPath',
    '/fields/System.AssignedTo'
  ]

  const normalizedCandidates = Array.from(
    new Set((assigneeCandidates || []).map((x) => String(x || '').trim()).filter(Boolean))
  )

  let currentPatch = [...patch]
  let lastError = null
  const attemptedAssignees = new Set()

  for (let attempt = 0; attempt <= optionalFields.length; attempt++) {
    try {
      const wi = await witApi.createWorkItem(null, currentPatch, project, workItemType)
      return wi
    } catch (err) {
      lastError = err
      if (isAssigneeError(err) && currentPatch.some((x) => x.path === '/fields/System.AssignedTo')) {
        const currentAssignee = getAssignedToFromPatch(currentPatch)
        if (currentAssignee) {
          attemptedAssignees.add(normalizeIdentity(currentAssignee))
        }

        const nextAssignee = normalizedCandidates.find(
          (candidate) => !attemptedAssignees.has(normalizeIdentity(candidate))
        )

        if (nextAssignee) {
          attemptedAssignees.add(normalizeIdentity(nextAssignee))
          currentPatch = setAssignedToPatch(currentPatch, nextAssignee)
          continue
        }

        currentPatch = removeAssignedToPatch(currentPatch)
        continue
      }

      if (!isInvalidFieldError(err)) {
        break
      }

      const removable =
        pickFieldFromError(err, currentPatch, optionalFields) ||
        optionalFields.find((fieldPath) => currentPatch.some((x) => x.path === fieldPath))

      if (!removable) {
        break
      }
      currentPatch = currentPatch.filter((x) => x.path !== removable)
    }
  }

  throw lastError
}

async function linkToParent({ witApi, project, childId, parentId, org, projectName }) {
  if (!childId || !parentId) return
  const linkDoc = [
    {
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Hierarchy-Reverse',
        url: `https://dev.azure.com/${org}/${projectName}/_apis/wit/workItems/${parentId}`,
        attributes: { comment: 'Parent linkage' }
      }
    }
  ]
  await witApi.updateWorkItem(null, linkDoc, childId, project)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { backlog, teamName, sprintName, brId, piName, artName } = req.body || {}
    const config = loadConfig()

    if (!config.organization || !config.project || !config.pat) {
      return res.status(400).json({ message: 'ADO not configured. Please configure ADO settings first.' })
    }

    if (!backlog || !backlog.epics) {
      return res.status(400).json({ message: 'Invalid backlog data' })
    }

    // Connect to ADO
    const authHandler = azdev.getPersonalAccessTokenHandler(config.pat)
    const connection = new azdev.WebApi(`https://dev.azure.com/${config.organization}`, authHandler)
    const witApi = await connection.getWorkItemTrackingApi()
    const supportedTypes = await getSupportedWorkItemTypes(witApi, config.project)
    const mappingInfo = resolveStrictTypeMapping(supportedTypes)
    const typeMapping = mappingInfo.typeMapping

    const iterationPath = await resolveIterationPath({
      org: config.organization,
      project: config.project,
      pat: config.pat,
      teamName,
      sprintName
    })
    const areaPath = await resolveAreaPath({
      org: config.organization,
      project: config.project,
      pat: config.pat,
      artName,
      teamName
    })
    const assigneeCandidates = await resolveAssigneeCandidatesForAdo({
      config,
      teamName,
      includeFallbackTeams: false
    })
    const assigneeAllocator = createRoundRobinAllocator(assigneeCandidates)
    const assignedTo = assigneeAllocator.primary
    const assignmentCoverage = {
      primaryAssignee: assignedTo || null,
      assigneePool: assigneeAllocator.pool,
      storiesTotal: 0,
      storiesAssigned: 0,
      tasksTotal: 0,
      tasksAssigned: 0,
      byAssignee: {}
    }

    const trackAssignment = (workType, assignee) => {
      const clean = String(assignee || '').trim()
      if (!clean) return

      if (!assignmentCoverage.byAssignee[clean]) {
        assignmentCoverage.byAssignee[clean] = {
          epics: 0,
          features: 0,
          stories: 0,
          tasks: 0,
          total: 0
        }
      }

      if (assignmentCoverage.byAssignee[clean][workType] !== undefined) {
        assignmentCoverage.byAssignee[clean][workType] += 1
      }
      assignmentCoverage.byAssignee[clean].total += 1
    }

    const storyPointsTotal = (backlog.userStories || []).reduce((acc, story) => {
      return acc + (Number(story?.points || 0) || 0)
    }, 0)

    const weightedStoryPointsTotal = Number((backlog.userStories || []).reduce((acc, story) => {
      const points = Number(story?.points || 0) || 0
      const weight = Number(story?.weight || 1) || 1
      return acc + (points * weight)
    }, 0).toFixed(2))

    const globalTags = [
      'Agentic',
      'Backlog',
      teamName ? `Team:${teamName}` : null,
      sprintName ? `Sprint:${sprintName}` : null,
      piName ? `PI:${String(piName).replace(/;/g, '-')}` : null,
      artName ? `ART:${String(artName).replace(/;/g, '-')}` : null,
      brId ? `BR:${brId}` : null
    ]
      .filter(Boolean)
      .join(';')

    const results = {
      epics: [],
      features: [],
      userStories: [],
      tasks: [],
      warnings: [...mappingInfo.warnings],
      errors: []
    }

    if (assigneeAllocator.pool.length <= 1) {
      results.warnings.push(
        'Assignee pool resolved to one identity. Add unique ADO-recognized identities per team member to enable balanced distribution.'
      )
    }

    // Step 1: Create Epics
    const epicIdMap = {}
    for (const epic of backlog.epics || []) {
      try {
        const epicDoc = buildPatch({
          title: epic.title,
          description: `${epic.description || ''}`.trim(),
          businessValue: epic.businessValue,
          effort: epic.effort,
          tags: globalTags,
          areaPath,
          iterationPath,
          assignedTo
        })

        const epicWI = await createWithFallbackFields({
          witApi,
          project: config.project,
          workItemType: typeMapping.epicType,
          patch: epicDoc,
          assigneeCandidates
        })
        epicIdMap[epic.title] = epicWI.id
        
        results.epics.push({
          title: epic.title,
          id: epicWI.id,
          assignedTo: extractAssignedTo(epicWI),
          workItemType: typeMapping.epicType,
          url: `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${epicWI.id}`,
          status: 'Created'
        })
        trackAssignment('epics', extractAssignedTo(epicWI))
      } catch (err) {
        results.errors.push({ type: 'Epic', title: epic.title, error: String(err) })
      }
    }

    // Step 2: Create Features (linked to Epics)
    const featureIdMap = {}
    for (const feature of backlog.features || []) {
      try {
        const featureWsjfScore = Number(feature?.wsjf?.score || feature?.wsjfScore || 0)
        const featureAssignee = assigneeAllocator.next() || assignedTo
        const featureTags = [
          globalTags,
          featureWsjfScore > 0 ? `WSJF:${featureWsjfScore.toFixed(2)}` : null,
          feature?.workType ? `WorkType:${String(feature.workType).replace(/;/g, '-')}` : null
        ].filter(Boolean).join(';')

        const featureDoc = buildPatch({
          title: feature.title,
          description: `${feature.description || ''}`.trim(),
          priority: feature.priority,
          businessValue: feature?.wsjf?.businessValue,
          effort: feature?.wsjf?.jobSize,
          tags: featureTags,
          areaPath,
          iterationPath,
          assignedTo: featureAssignee
        })

        const featureWI = await createWithFallbackFields({
          witApi,
          project: config.project,
          workItemType: typeMapping.featureType,
          patch: featureDoc,
          assigneeCandidates: assigneeAllocator.orderedCandidates(featureAssignee)
        })
        
        featureIdMap[feature.title] = featureWI.id

        // Link to parent Epic if specified
        if (feature.epic && epicIdMap[feature.epic]) {
          try {
            await linkToParent({
              witApi,
              project: config.project,
              childId: featureWI.id,
              parentId: epicIdMap[feature.epic],
              org: config.organization,
              projectName: config.project
            })
          } catch (linkErr) {
            results.warnings.push(`Feature link failed (${feature.title} -> ${feature.epic}): ${String(linkErr)}`)
          }
        }

        results.features.push({
          title: feature.title,
          id: featureWI.id,
          parentEpic: feature.epic,
          wsjfScore: featureWsjfScore > 0 ? featureWsjfScore : null,
          workType: feature?.workType || null,
          assignedTo: extractAssignedTo(featureWI),
          workItemType: typeMapping.featureType,
          url: `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${featureWI.id}`,
          status: 'Created'
        })
        trackAssignment('features', extractAssignedTo(featureWI))
      } catch (err) {
        results.errors.push({ type: 'Feature', title: feature.title, error: String(err) })
      }
    }

    // Step 3: Create User Stories/PBIs (linked to Features)
    for (const story of backlog.userStories || []) {
      try {
        const storyAssignee = assigneeAllocator.next() || assignedTo
        const storyAssigneeCandidates = assigneeAllocator.orderedCandidates(storyAssignee)
        const acceptanceText = (story.acceptanceCriteria || []).map((ac, i) => `${i + 1}. ${ac}`).join('\n')
        const storyDoc = buildPatch({
          title: story.title,
          description: `${story.userStory || ''}`.trim(),
          points: story.points,
          acceptanceCriteria: acceptanceText || null,
          tags: [
            globalTags,
            story?.workType ? `WorkType:${String(story.workType).replace(/;/g, '-')}` : null
          ].filter(Boolean).join(';'),
          areaPath,
          iterationPath,
          assignedTo: storyAssignee
        })

        const storyWI = await createWithFallbackFields({
          witApi,
          project: config.project,
          workItemType: typeMapping.storyType,
          patch: storyDoc,
          assigneeCandidates: storyAssigneeCandidates
        })
        const storyAssignedTo = extractAssignedTo(storyWI)
        assignmentCoverage.storiesTotal += 1
        if (storyAssignedTo) assignmentCoverage.storiesAssigned += 1
        trackAssignment('stories', storyAssignedTo)

        // Link to parent Feature if specified
        if (story.feature && featureIdMap[story.feature]) {
          try {
            await linkToParent({
              witApi,
              project: config.project,
              childId: storyWI.id,
              parentId: featureIdMap[story.feature],
              org: config.organization,
              projectName: config.project
            })
          } catch (linkErr) {
            results.warnings.push(`Story link failed (${story.title} -> ${story.feature}): ${String(linkErr)}`)
          }
        }

        // Step 4: Create Tasks under each story from acceptance criteria.
        for (let i = 0; i < (story.acceptanceCriteria || []).length; i++) {
          const criterion = story.acceptanceCriteria[i]
          if (!criterion) continue
          try {
            const taskAssignee = assigneeAllocator.next() || storyAssignedTo || storyAssignee
            const taskAssigneeCandidates = assigneeAllocator.orderedCandidates(taskAssignee)
            const taskDoc = buildPatch({
              title: `${story.title} - Task ${i + 1}`,
              description: criterion,
              tags: `${globalTags};AC-Task${story?.workType ? `;WorkType:${String(story.workType).replace(/;/g, '-')}` : ''}`,
              areaPath,
              iterationPath,
              assignedTo: taskAssignee
            })
            const taskWI = await createWithFallbackFields({
              witApi,
              project: config.project,
              workItemType: typeMapping.taskType,
              patch: taskDoc,
              assigneeCandidates: taskAssigneeCandidates
            })
            const taskAssignedTo = extractAssignedTo(taskWI)
            assignmentCoverage.tasksTotal += 1
            if (taskAssignedTo) assignmentCoverage.tasksAssigned += 1
            trackAssignment('tasks', taskAssignedTo)

            await linkToParent({
              witApi,
              project: config.project,
              childId: taskWI.id,
              parentId: storyWI.id,
              org: config.organization,
              projectName: config.project
            })

            results.tasks.push({
              title: `${story.title} - Task ${i + 1}`,
              id: taskWI.id,
              parentStory: story.title,
              assignedTo: taskAssignedTo,
              workItemType: typeMapping.taskType,
              url: `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${taskWI.id}`,
              status: 'Created'
            })
          } catch (taskErr) {
            results.errors.push({
              type: 'Task',
              title: `${story.title} - Task ${i + 1}`,
              error: String(taskErr)
            })
          }
        }

        results.userStories.push({
          title: story.title,
          id: storyWI.id,
          parentFeature: story.feature,
          workType: story?.workType || null,
          assignedTo: storyAssignedTo,
          points: Number(story?.points || 0) || 0,
          weight: Number(story?.weight || 1) || 1,
          workItemType: typeMapping.storyType,
          url: `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${storyWI.id}`,
          status: 'Created'
        })
      } catch (err) {
        results.errors.push({ type: 'User Story', title: story.title, error: String(err) })
      }
    }

    if (!iterationPath && (teamName || sprintName)) {
      results.warnings.push(
        `Iteration path not found for team='${teamName || '-'}' sprint='${sprintName || '-'}'. Backlog items were created without sprint assignment.`
      )
    }

    if (areaPath === config.project && (artName || teamName)) {
      results.warnings.push(
        `Area path fallback to project root '${config.project}'. Provide matching ART/team area nodes in ADO for stricter portfolio-to-team traceability.`
      )
    }

    const uniqueAssigned = Object.keys(assignmentCoverage.byAssignee || {})
    if (uniqueAssigned.length <= 1 && assigneeAllocator.pool.length > 1) {
      results.warnings.push(
        'Backlog items were ultimately assigned to one ADO identity. Verify that each team member email maps to an entitled ADO user in the organization directory.'
      )
    }

    res.status(200).json({
      success: true,
      summary: {
        epicsCreated: results.epics.length,
        featuresCreated: results.features.length,
        userStoriesCreated: results.userStories.length,
        tasksCreated: results.tasks.length,
        errors: results.errors.length
      },
      metadata: {
        typeMapping,
        processHint: mappingInfo.processHint,
        guardrails: mappingInfo.warnings,
        supportedTypes: Array.from(supportedTypes.values()).sort(),
        areaPath,
        iterationPath,
        piName: piName || null,
        artName: artName || null,
        assignedTo: assignedTo || null,
        assigneeCandidates,
        assignmentCoverage: {
          ...assignmentCoverage,
          storiesAssignedRatio: assignmentCoverage.storiesTotal
            ? Number((assignmentCoverage.storiesAssigned / assignmentCoverage.storiesTotal).toFixed(2))
            : 0,
          tasksAssignedRatio: assignmentCoverage.tasksTotal
            ? Number((assignmentCoverage.tasksAssigned / assignmentCoverage.tasksTotal).toFixed(2))
            : 0
        },
        storyPointsTotal,
        weightedStoryPointsTotal,
        burndownReady: Boolean(iterationPath && results.userStories.length > 0 && results.tasks.length > 0),
        assignmentStrategy: 'round-robin'
      },
      results
    })
  } catch (err) {
    console.error('ADO backlog creation error', err)
    res.status(500).json({ message: 'Failed to create backlog in ADO', error: String(err) })
  }
}
