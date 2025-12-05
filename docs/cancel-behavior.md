### Chat cancel behavior options

This document describes how the chat **Cancel** button behaves and compares two UI options for how the Send/Cancel area should behave immediately after cancelling.

Currently, cancelling:

- Stops the **current assistant streaming response**.
- **Does not remove** any messages that are already stored in the conversation.
- Relies on the underlying AI SDK to finalize and persist whatever text was generated up to the cancel moment.

The open design choice is **what happens to the Send/Cancel button area right after the user presses Cancel**.

---

### Option A: Immediate switch back to Send (current behavior)

When the user clicks **Cancel**, the UI:

- Immediately stops showing the streaming indicator.
- Immediately replaces the **Cancel** button with the normal **Send** button.
- Allows the user to type and send a new message right away.

**Pros**

- **Highly responsive UX**: The interface feels fast and predictable; the user sees immediate feedback when they press Cancel.
- **Low perceived latency**: No visible wait for any backend confirmation before they can continue interacting.
- **Simple mental model**: “Once I hit Cancel, I’m free to continue as if the response finished.”
- **Implementation simplicity**: Less state to manage; no extra “cancelling…” state needed in the UI.

**Cons**

- **Potential mismatch with backend timing**: In rare cases, the server might still be finishing up cancellation after the UI has already switched, which could make debugging backend issues a bit harder.
- **Edge‑case race conditions**: If the backend continues streaming briefly, there’s a small window where unexpected data could arrive (though the client is already instructed to stop).

---

### Option B: Wait for backend confirmation before switching back

When the user clicks **Cancel**, the UI would:

- Show a short-lived **“Cancelling…”** or disabled state.
- Only swap **Cancel** back to **Send** after either:
  - The backend confirms the stream has stopped, or
  - A timeout / safety condition is reached.

**Pros**

- **Stronger alignment with backend state**: The Send button won’t fully “re-arm” until the system is very likely done handling the previous request.
- **Clearer lifecycle for debugging**: Developers can reason about a distinct “cancelling” phase in logs and telemetry.
- **Better for strict sequencing**: If you later enforce “only one in-flight request per conversation,” this makes that contract explicit in the UI.

**Cons**

- **Feels slower to users**: Even a small delay between pressing Cancel and regaining full control can feel laggy or unresponsive.
- **More UI complexity**: Requires additional state (`isCancelling`), messaging, and edge-case handling (e.g., timeouts, error states).
- **Higher implementation and maintenance cost**: More logic paths to test and keep in sync with backend behavior.

---

### Which option is implemented now?

- The implementation currently follows **Option A: Immediate switch back to Send**.
- The Cancel button appears **only while a response is streaming**, and pressing it:
  - Stops the active stream on the client.
  - Signals the backend via the request’s abort signal so that generation can stop early when supported.
  - Returns the UI to a normal **Send** state as soon as the cancel action is triggered/completed on the client.

To move towards **Option B** later, you would:

- Introduce a separate `isCancelling` flag alongside the existing streaming/loading state.
- Keep the button area in a “Cancelling…” state until either:
  - You observe that the streaming status has fully resolved, or
  - A configured timeout elapses, after which you fall back to the normal **Send** state.


