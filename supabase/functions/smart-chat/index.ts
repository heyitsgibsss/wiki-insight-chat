import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // First, determine if this is an information request or casual conversation
    const classificationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a classifier. Determine if the user message is asking for factual information/knowledge (like "what is...", "who is...", "tell me about...", "explain...", etc.) or if it\'s casual conversation (greetings, small talk, opinions, etc.). Respond with ONLY "INFORMATION" or "CASUAL".'
          },
          {
            role: 'user',
            content: query
          }
        ],
      }),
    });

    const classificationData = await classificationResponse.json();
    const classification = classificationData.choices[0].message.content.trim();

    console.log('Classification:', classification, 'for query:', query);

    // If it's an information request, fetch from Wikipedia
    if (classification === 'INFORMATION') {
      try {
        // Extract the main topic from the query using AI
        const topicResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'Extract the main topic/subject from the user query for a Wikipedia search. Return ONLY the topic name, nothing else. For example, if user asks "what is quantum physics", return "quantum physics".'
              },
              {
                role: 'user',
                content: query
              }
            ],
          }),
        });

        const topicData = await topicResponse.json();
        const topic = topicData.choices[0].message.content.trim();
        
        console.log('Extracted topic:', topic);

        // Search Wikipedia
        const wikiResponse = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`
        );

        if (wikiResponse.ok) {
          const wikiData = await wikiResponse.json();
          return new Response(
            JSON.stringify({
              summary: wikiData.extract || 'No information found.',
              url: wikiData.content_urls?.desktop?.page,
              type: 'wikipedia'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error('Wikipedia fetch error:', error);
        // Fall through to casual response if Wikipedia fails
      }
    }

    // For casual conversation or if Wikipedia fails, use Gemini
    const chatResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are WikiChat, a friendly and helpful AI assistant. For casual conversation, respond naturally and warmly. Keep responses concise and engaging.'
          },
          {
            role: 'user',
            content: query
          }
        ],
      }),
    });

    const chatData = await chatResponse.json();
    const response = chatData.choices[0].message.content;

    return new Response(
      JSON.stringify({
        summary: response,
        type: 'chat'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in smart-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
