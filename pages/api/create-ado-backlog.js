import fs from 'fs'
import path from 'path'
import * as azdev from 'azure-devops-node-api'

const configPath = path.join(process.cwd(), 'public', '.ado-config.json')

function loadConfig() {
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(data)
  }
  return {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { backlog } = req.body
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

    const results = {
      epics: [],
      features: [],
      userStories: [],
      errors: []
    }

    // Step 1: Create Epics
    const epicIdMap = {} // Map epic title to ADO work item ID
    for (const epic of backlog.epics || []) {
      try {
        const epicDoc = [
          { op: 'add', path: '/fields/System.Title', value: epic.title },
          { op: 'add', path: '/fields/System.Description', value: `${epic.description}\n\nBusiness Value: ${epic.businessValue}\nEstimated Effort: ${epic.effort}` }
        ]

        const epicWI = await witApi.createWorkItem(null, epicDoc, config.project, 'Epic')
        epicIdMap[epic.title] = epicWI.id
        
        results.epics.push({
          title: epic.title,
          id: epicWI.id,
          url: `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${epicWI.id}`,
          status: 'Created'
        })
      } catch (err) {
        results.errors.push({ type: 'Epic', title: epic.title, error: String(err) })
      }
    }

    // Step 2: Create Features (linked to Epics)
    const featureIdMap = {} // Map feature title to ADO work item ID
    for (const feature of backlog.features || []) {
      try {
        const featureDoc = [
          { op: 'add', path: '/fields/System.Title', value: feature.title },
          { op: 'add', path: '/fields/System.Description', value: `${feature.description}\n\nPriority: ${feature.priority}` }
        ]

        const featureWI = await witApi.createWorkItem(null, featureDoc, config.project, 'Task')
        
        if (!featureWI) {
          throw new Error('Failed to create Task - API returned null')
        }
        
        featureIdMap[feature.title] = featureWI.id

        // Link to parent Epic if specified
        if (feature.epic && epicIdMap[feature.epic]) {
          try {
            const linkDoc = [
              {
                op: 'add',
                path: '/relations/-',
                value: {
                  rel: 'System.LinkTypes.Hierarchy-Reverse',
                  url: `https://dev.azure.com/${config.organization}/${config.project}/_apis/wit/workItems/${epicIdMap[feature.epic]}`,
                  attributes: { comment: 'Parent Epic' }
                }
              }
            ]
            await witApi.updateWorkItem(null, linkDoc, featureWI.id, config.project)
          } catch (linkErr) {
            console.error('Failed to link feature to epic', linkErr)
          }
        }

        results.features.push({
          title: feature.title,
          id: featureWI.id,
          parentEpic: feature.epic,
          url: `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${featureWI.id}`,
          status: 'Created'
        })
      } catch (err) {
        results.errors.push({ type: 'Feature', title: feature.title, error: String(err) })
      }
    }

    // Step 3: Create User Stories (linked to Features)
    for (const story of backlog.userStories || []) {
      try {
        const storyDoc = [
          { op: 'add', path: '/fields/System.Title', value: story.title },
          { op: 'add', path: '/fields/System.Description', value: `${story.userStory}\n\nStory Points: ${story.points}` }
        ]

        // Add acceptance criteria if available
        if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
          storyDoc.push({
            op: 'add',
            path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
            value: story.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')
          })
        }

        const storyWI = await witApi.createWorkItem(null, storyDoc, config.project, 'Task')
        
        if (!storyWI) {
          throw new Error('Failed to create Task - API returned null')
        }

        // Link to parent Feature if specified
        if (story.feature && featureIdMap[story.feature]) {
          try {
            const linkDoc = [
              {
                op: 'add',
                path: '/relations/-',
                value: {
                  rel: 'System.LinkTypes.Hierarchy-Reverse',
                  url: `https://dev.azure.com/${config.organization}/${config.project}/_apis/wit/workItems/${featureIdMap[story.feature]}`,
                  attributes: { comment: 'Parent Feature' }
                }
              }
            ]
            await witApi.updateWorkItem(null, linkDoc, storyWI.id, config.project)
          } catch (linkErr) {
            console.error('Failed to link story to feature', linkErr)
          }
        }

        results.userStories.push({
          title: story.title,
          id: storyWI.id,
          parentFeature: story.feature,
          url: `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${storyWI.id}`,
          status: 'Created'
        })
      } catch (err) {
        results.errors.push({ type: 'User Story', title: story.title, error: String(err) })
      }
    }

    res.status(200).json({
      success: true,
      summary: {
        epicsCreated: results.epics.length,
        featuresCreated: results.features.length,
        userStoriesCreated: results.userStories.length,
        errors: results.errors.length
      },
      results
    })
  } catch (err) {
    console.error('ADO backlog creation error', err)
    res.status(500).json({ message: 'Failed to create backlog in ADO', error: String(err) })
  }
}
