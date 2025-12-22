import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

serve(async (req) => {
  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Return the Loader.io verification token
  return new Response("loaderio-f9dc9913c1bee8cb36146f86ae79d15a", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
});
