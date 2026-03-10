import { mutateConfig, readConfig, writeConfig } from "../../lib/config-store";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const config = await readConfig();
      return res.status(200).json(config);
    }

    if (req.method === "PUT") {
      const { mode, section, action, id, item, config } = req.body || {};

      if (mode === "replace") {
        const saved = await writeConfig(config || {});
        return res.status(200).json(saved);
      }

      const saved = await mutateConfig({ section, action, id, item });
      return res.status(200).json(saved);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Request failed" });
  }
}
