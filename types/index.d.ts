declare module 'claude-code' {
  interface PluginState {
    'prompt-marks': {
      // Prompt message ids in transcript order. Module variables are lost when the mod reloads, and the engine
      // draws only some of the transcript's rows again, so the order is kept here between reloads.
      order: string[]
    }
  }
}
