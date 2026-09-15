import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createServerSupabase } from "@/lib/supabase";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper: Extract and validate auth token from request
function getAuthToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.replace("Bearer ", "");
}

// Helper: Generate a short title from the first user message
async function generateTitle(message) {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Generate a very short title (max 6 words, no quotes) summarizing this message: "${message.slice(0, 200)}"`,
    });
    return response.text?.trim() || "New Chat";
  } catch {
    // Fallback: truncate the message
    return message.slice(0, 40) + (message.length > 40 ? "..." : "");
  }
}

export async function POST(request) {
  try {
    // 1. Auth check
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const supabase = createServerSupabase(token);

    // Verify user from token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session. Please sign in again." },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { message, conversationId, history } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    if (message.length > 30000) {
      return NextResponse.json(
        { error: "Message is too long. Maximum 30,000 characters." },
        { status: 400 }
      );
    }

    // 3. Create or get conversation
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      // Create a new conversation
      const title = await generateTitle(message);

      const { data: newConversation, error: createError } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating conversation:", createError);
        return NextResponse.json(
          { error: "Failed to create conversation." },
          { status: 500 }
        );
      }

      activeConversationId = newConversation.id;
    } else {
      // Verify the conversation exists and belongs to the user
      const { data: existingConversation, error: fetchError } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", activeConversationId)
        .single();

      if (fetchError || !existingConversation) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 }
        );
      }
    }

    // 4. Save the user's message
    const { error: saveUserMsgError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: message.trim(),
    });

    if (saveUserMsgError) {
      console.error("Error saving user message:", saveUserMsgError);
      return NextResponse.json(
        { error: "Failed to save message." },
        { status: 500 }
      );
    }

    // 5. Build conversation history for Gemini
    const geminiHistory = (history || []).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // 6. Call Gemini API with retry logic
    let aiResponseText = "";
    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      try {
        const chat = genAI.chats.create({
          model: "gemini-3.6-flash",
          history: geminiHistory,
          config: {
            systemInstruction:
              "You are a helpful, friendly, and knowledgeable AI assistant. Respond clearly and concisely. Use markdown formatting when appropriate for code, lists, and structured content. If you don't know something, say so honestly.",
          },
        });

        const response = await chat.sendMessage({ message: message.trim() });
        aiResponseText = response.text || "I'm sorry, I couldn't generate a response.";
        break; // Success — exit retry loop
      } catch (geminiError) {
        retries++;
        const status = geminiError?.status || geminiError?.httpStatusCode;

        if (status === 429 || (status >= 500 && status < 600)) {
          if (retries > maxRetries) {
            console.error("Gemini API failed after retries:", geminiError);
            return NextResponse.json(
              {
                error:
                  "The AI service is temporarily overloaded. Please try again in a moment.",
              },
              { status: 503 }
            );
          }
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 1000)
          );
        } else if (geminiError?.message?.includes("SAFETY")) {
          aiResponseText =
            "I'm unable to respond to that request due to safety guidelines. Please try rephrasing your question.";
          break;
        } else {
          console.error("Gemini API error:", geminiError);
          return NextResponse.json(
            { error: "Failed to get AI response. Please try again." },
            { status: 500 }
          );
        }
      }
    }

    // 7. Save the AI response
    const { error: saveAiMsgError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "model",
      content: aiResponseText,
    });

    if (saveAiMsgError) {
      console.error("Error saving AI message:", saveAiMsgError);
      // Still return the response even if saving fails
    }

    // 8. Update conversation's updated_at timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeConversationId);

    // 9. Return the response
    return NextResponse.json({
      conversationId: activeConversationId,
      message: {
        role: "model",
        content: aiResponseText,
      },
    });
  } catch (error) {
    console.error("Unhandled error in chat/send:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
