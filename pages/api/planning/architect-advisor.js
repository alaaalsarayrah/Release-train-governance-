import { runSingleAgentEndpoint } from '../../../lib/planning/single-agent-handler'

export default async function handler(req, res) {
  return runSingleAgentEndpoint(req, res, 'architect_advisor')
}
