import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

// Helper: Extract auth token
function getAuthToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.replace("Bearer ", "");
}

// GET /api/chat/conversations/[id] — Get a single conversation with all messages
export async function GET(request, { params }) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const supabase = createServerSupabase(token);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch conversation
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("id", id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Error fetching messages:", msgError);
      return NextResponse.json(
        { error: "Failed to fetch messages." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation: {
        ...conversation,
        messages,
      },
    });
  } catch (error) {
    console.error("Unhandled error in conversation/[id]:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/conversations/[id] — Delete a conversation and its messages
export async function DELETE(request, { params }) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const supabase = createServerSupabase(token);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Delete conversation (messages are cascade-deleted)
    const { error: deleteError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting conversation:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete conversation." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unhandled error in DELETE conversation:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
