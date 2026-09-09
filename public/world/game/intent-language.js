/** Shared conservative language gate. Interpretation never applies consequences. */
export function inspectIntentLanguage(raw) {
  const text=String(raw||'').trim().toLowerCase().replace(/[’‘]/g,"'").slice(0,600)
  const quoted=/["“”]|(?:^|\s)'[^']+'(?:\s|$)|\b(?:he|she|they|someone) (?:said|says|told|asked)\b/.test(text)
  const question=/\?|^(?:what|why|where|who|when|how|could|can|would|do|does|is|are|will|tell me|explain)\b/.test(text)
  const conditional=/\b(?:maybe|might|perhaps|unless|if|provided|assuming|suppose|possibly|not sure|as long as|thinking about)\b/.test(text)
  const negative=/\b(?:no|not|never|cannot|can't|won't|don't|doesn't|wouldn't|couldn't|shouldn't|refuse|decline|rather not)\b/.test(text)
  const mixed=negative&&/\b(?:but|instead|however|although|except|rather than)\b/.test(text)
  return {text,guard:!text||quoted?'clarify':question?'question':conditional||mixed?'clarify':negative?'refuse':null}
}
