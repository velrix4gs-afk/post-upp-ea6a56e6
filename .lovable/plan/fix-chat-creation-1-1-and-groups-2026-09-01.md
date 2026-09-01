# Fix chat creation (1:1 and groups)

## What I verified in the live database

- No chat row has been created since 2026-08-04, and **every** row in `chats` has `created_by = NULL` — meaning no chat has ever been created through the current client code path (which always sets `created_by`/`creator_id`).
- There are leftover private chats with **0 or 1 participants** — the fingerprint of a creation flow that inserted the chat row and then failed before adding both participants.
- `chats` has **no DELETE policy**, so the rollback `delete()` inside `src/lib/chatCreation.ts` silently does nothing. Every failed attempt leaves an orphan chat behind, and those orphans show up as empty conversations.
- `chats` has **six** overlapping INSERT policies and **seven** SELECT policies with conflicting conditions. The multi-step client flow (insert chat → select it back → insert participant A → insert participant B) has to satisfy a different policy at each step, which is why it is fragile.
- The existing helper functions are unreliable: `create_chat()` inserts into a non-existent `chats.receiver_id` column (it would always error), and `create_private_chat()` inserts a chat without setting `type` or ownership columns.
- Group creation calls `create_group_chat_with_participants()`, which is correct and atomic — so groups likely fail for a different reason than 1:1 chats.

The exact runtime error is not yet captured, so step 1 is reproduction.

## CHANGE PLAN

**Files affected**
- `src/lib/chatCreation.ts` — replace the multi-step insert with a single atomic RPC call.
- New database migration — add one `ensure_private_chat` function.
- `src/components/messaging/GroupChatDialog.tsx` — surface the real RPC error instead of a generic message (no logic rewrite).

**Untouched**
- `useChats.ts`, `useMessages.ts`, `ProfilePage.tsx`, `MiniProfilePopup.tsx`, `MessagesPage.tsx` all keep calling the same functions with the same signatures.
- No existing RLS policy, table, column, or database function is dropped or altered.
- Mutual-follow gating, message sending, realtime, and the chat list stay exactly as they are.

**Risks**
- Adding a `SECURITY DEFINER` function means it must validate the caller itself; it will hard-check `auth.uid()` and refuse any call where the caller is not one of the two participants.

## IMPLEMENTATION

1. **Reproduce first.** Sign in against the running app, open Messages → New Message, pick a mutual follower, and capture the exact PostgREST error from the console/network. Do the same for Create Group. The fix below is applied regardless, but the captured error confirms the diagnosis.

2. **New migration** — add (nothing dropped):

```text
ensure_private_chat(p_other_user uuid) returns uuid
  security definer, search_path = public
  - reject if auth.uid() is null, or p_other_user = auth.uid()
  - return the existing private chat when both users already share one
  - otherwise insert chats(type='private', created_by=auth.uid(), creator_id=auth.uid())
    plus both chat_participants rows in one transaction
  grant execute to authenticated
```
   Because it runs as definer, all four steps happen in one transaction under one identity — no partial chat can survive a failure, so no new orphans.

3. **`src/lib/chatCreation.ts`** — keep the exported `ensurePrivateChat(userId, otherUserId)` signature and its UUID/self-chat validation, but replace the body's insert sequence with the single `ensure_private_chat` RPC call. All four existing call sites work unchanged.

4. **Clean up the orphans** in the same migration: delete `private` chats that have fewer than 2 participants and no messages. This removes the empty conversations already showing in the list.

5. **`GroupChatDialog.tsx`** — pass the RPC's real error text into the toast so the next failure is diagnosable. No change to the creation logic itself.

## REGRESSION CHECK

After the change I will confirm: existing chats still load in Messages; opening an existing conversation still works; sending a text message still works; group creation still adds all selected members; the mutual-follow restriction on new DMs still applies; the profile "Message" button and mini-profile popup still open the right chat.
