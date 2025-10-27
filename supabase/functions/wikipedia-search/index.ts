import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Searching Wikipedia for:", query);

    // Use Wikipedia's REST API to get page summary
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "WikiChat/1.0",
      },
    });

    if (!response.ok) {
      // If exact match fails, try searching for the term
      const searchApiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`;
      const searchResponse = await fetch(searchApiUrl);
      const searchData = await searchResponse.json();

      if (searchData[1] && searchData[1][0]) {
        // Try getting summary of first search result
        const firstResult = searchData[1][0];
        const retryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult)}`;
        const retryResponse = await fetch(retryUrl, {
          headers: { "User-Agent": "WikiChat/1.0" },
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          return new Response(
            JSON.stringify({
              summary: retryData.extract || "No summary available.",
              url: retryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(firstResult)}`,
              title: retryData.title || firstResult,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ 
          summary: "I couldn't find a Wikipedia page for that topic. Please try rephrasing your question or searching for a different topic.",
          url: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        summary: data.extract || "No summary available.",
        url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
        title: data.title || query,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in wikipedia-search function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});