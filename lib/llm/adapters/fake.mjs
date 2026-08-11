/**
 * Test double adapter — inject via createGateway for unit tests.
 */

/**
 * @param {(ctx: import('../types.mjs').AdapterContext) => Promise<{ text: string, usage?: import('../types.mjs').NormalizedUsage }>} responder
 * @param {import('../types.mjs').AdapterId} [id]
 */
export function createFakeAdapter(responder, id = 'openai-compatible') {
  return {
    id,
    async complete(ctx) {
      const result = await responder(ctx);
      if (!result?.text) {
        throw new Error('fake adapter must return { text, usage? }');
      }
      return {
        text: result.text,
        usage: result.usage ?? {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          cached_tokens: 0,
        },
      };
    },
  };
}

export default createFakeAdapter;
