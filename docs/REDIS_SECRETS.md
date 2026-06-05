# Redis Secrets

The Redis cache layer is reached **only** server-side, through the
`redis-bridge` Supabase Edge Function. Credentials are never bundled into
the client.

## Required edge-function secrets

| Name         | Description                                                |
| ------------ | ---------------------------------------------------------- |
| `REDIS_URL`  | Upstash-compatible REST endpoint (HTTPS).                  |
| `REDIS_TOKEN`| Bearer token issued by the Redis provider dashboard.       |

Add them in **Supabase → Project Settings → Edge Functions → Secrets**, or
ask Lovable to add them via the secrets tool. They become available to the
edge function as `Deno.env.get("REDIS_URL")` / `Deno.env.get("REDIS_TOKEN")`.

## Hard rules

- Never commit Redis host, port, or password to the repository.
- Never reference these secrets from any `src/**` file.
- Never expose the raw connection string in client logs, network responses,
  or error messages.
- All client requests must go through `apiGateway.invokeFunction('redis-bridge', ...)`.

## Client usage

```ts
import { invokeFunction } from "@/lib/apiGateway";

await invokeFunction("redis-bridge", { op: "set", key: "feed-cursor", value: "..." });
const { data } = await invokeFunction<{ result: string | null }>(
  "redis-bridge",
  { op: "get", key: "feed-cursor" },
);
```

Keys are automatically namespaced per authenticated user, so collisions
between users are impossible.
