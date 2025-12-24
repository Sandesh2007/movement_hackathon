"""
Orchestrated Executor for Combined Sentiment + Trading Agent

Uses Google ADK Runner to execute SequentialAgent with sentiment and trading analysis.
"""

import json

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.utils import new_agent_text_message
from google.adk.runners import InMemoryRunner
from google.adk.runners import types

from .core.constants import DEFAULT_SESSION_ID, ERROR_CANCEL_NOT_SUPPORTED, ERROR_EXECUTION_ERROR
from .orchestrated_agent import root_agent


def _get_session_id(context: RequestContext) -> str:
    """Extract session ID from context."""
    return getattr(context, "context_id", DEFAULT_SESSION_ID)


def _build_execution_error_response(error: Exception) -> str:
    """Build response for execution error."""
    return json.dumps(
        {
            "type": "sentiment_trading",
            "success": False,
            "error": f"{ERROR_EXECUTION_ERROR}: {str(error)}",
        },
        indent=2,
    )


class OrchestratedSentimentExecutor(AgentExecutor):
    """Executor for Combined Sentiment + Trading Agent using Google ADK SequentialAgent."""

    def __init__(self):
        self.agent = root_agent

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        """Execute the combined sentiment+trading agent request."""
        query = context.get_user_input()
        session_id = _get_session_id(context)

        print(f"🔍 Orchestrated Sentiment+Trading Agent received query: {query}")
        print(f"   Session ID: {session_id}")

        try:
            # Use Runner to properly execute SequentialAgent
            app_name = "agents"
            runner = InMemoryRunner(
                agent=self.agent,
                app_name=app_name,
            )

            # Create or get the session
            session = await runner.session_service.get_session(
                app_name=app_name,
                user_id="user",
                session_id=session_id,
            )
            if not session:
                session = await runner.session_service.create_session(
                    app_name=app_name,
                    user_id="user",
                    session_id=session_id,
                )

            # Run the sequential agent with the query
            # Construct message using UserContent with Part
            new_message = types.UserContent(parts=[types.Part(text=query)])

            # Collect all events and extract the FINAL agent response
            # We want the LAST response from the trading analysis agent, not intermediate ones
            final_response = None
            all_responses = []  # Collect all responses to get the last one

            event_count = 0
            async for event in runner.run_async(
                user_id="user",
                session_id=session_id,
                new_message=new_message,
            ):
                event_count += 1
                # Debug: print event type and details
                event_type = type(event).__name__
                print(f"📨 Event #{event_count}: {event_type}")

                # Try to extract text from event - collect ALL responses
                event_text = None
                if hasattr(event, "content"):
                    content = event.content
                    print(f"   🔍 Event has content attribute: {type(content).__name__}")
                    if isinstance(content, str) and content.strip():
                        event_text = content
                        print(f"   ✅ Content is string (length: {len(content)})")
                    elif hasattr(content, "text") and content.text:
                        event_text = content.text
                        print(f"   ✅ Content has text attribute (length: {len(content.text)})")
                    elif hasattr(content, "parts"):
                        # Extract text from parts
                        print(f"   🔍 Content has parts: {len(content.parts) if hasattr(content.parts, '__len__') else 'unknown'}")
                        text_parts = []
                        for i, part in enumerate(content.parts):
                            if hasattr(part, "text") and part.text:
                                text_parts.append(part.text)
                                print(f"      Part {i}: text (length: {len(part.text)})")
                            else:
                                print(f"      Part {i}: {type(part).__name__} (no text)")
                        if text_parts:
                            event_text = "\n".join(text_parts)
                            print(f"   ✅ Combined {len(text_parts)} text parts (total length: {len(event_text)})")

                # Also check for text attribute directly on event
                if not event_text and hasattr(event, "text") and event.text:
                    event_text = event.text
                    print(f"   ✅ Event has direct text attribute (length: {len(event_text)})")

                # Store this response (we'll use the last one)
                if event_text and event_text.strip():
                    all_responses.append(event_text)
                    preview = event_text[:300].replace("\n", "\\n")
                    print(f"   📝 Captured response #{len(all_responses)} (length: {len(event_text)}): {preview}...")
                else:
                    print(f"   ⚠️  No text extracted from event #{event_count}")

            # Use the LAST response (from trading analysis agent)
            if all_responses:
                final_response = all_responses[-1]
                print(f"✅ Using final response (response {len(all_responses)} of {len(all_responses)})")
                print(f"   📊 Final response length: {len(final_response)}")
                print(f"   📄 Final response preview: {final_response[:500]}...")
                if len(all_responses) > 1:
                    print(f"   📋 All responses: {[len(r) for r in all_responses]}")

            # Get the session to check messages for agent response
            session = await runner.session_service.get_session(
                app_name=app_name,
                user_id="user",
                session_id=session_id,
            )

            # If no response from events, or if we got intermediate responses, try to get from session messages
            # Session messages should have the final response from the trading analysis agent
            if session:
                # Try different ways to access messages
                messages = None
                if hasattr(session, "messages"):
                    messages = session.messages
                elif hasattr(session, "state") and isinstance(session.state, dict):
                    messages = session.state.get("messages", [])

                if messages:
                    print(f"📋 Found {len(messages)} messages in session")
                    # Find ALL assistant messages and use the LAST one (from trading analysis agent)
                    assistant_messages = []
                    for message in messages:
                        # Check different message formats
                        role = None
                        if hasattr(message, "role"):
                            role = message.role
                        elif isinstance(message, dict):
                            role = message.get("role")

                        if role == "assistant" or role == "model":
                            # Extract content from message
                            content = None
                            if hasattr(message, "content"):
                                content = message.content
                            elif isinstance(message, dict):
                                content = message.get("content")

                            if content:
                                message_text = None
                                if isinstance(content, str):
                                    message_text = content
                                elif hasattr(content, "text"):
                                    message_text = content.text
                                elif hasattr(content, "parts"):
                                    text_parts = []
                                    for part in content.parts:
                                        if hasattr(part, "text") and part.text:
                                            text_parts.append(part.text)
                                    if text_parts:
                                        message_text = "\n".join(text_parts)
                                elif isinstance(content, list):
                                    # Content might be a list of parts
                                    text_parts = []
                                    for part in content:
                                        if isinstance(part, str):
                                            text_parts.append(part)
                                        elif hasattr(part, "text") and part.text:
                                            text_parts.append(part.text)
                                    if text_parts:
                                        message_text = "\n".join(text_parts)

                                if message_text and message_text.strip():
                                    assistant_messages.append(message_text)

                    # Use the LAST assistant message (from trading analysis agent)
                    if assistant_messages:
                        final_response = assistant_messages[-1]
                        print(f"✅ Using final session message (message {len(assistant_messages)} of {len(assistant_messages)})")
                        if len(assistant_messages) > 1:
                            print(f"   (Skipped {len(assistant_messages) - 1} intermediate messages)")

            # If still no response, check if it's a simple sentiment query
            # and fall back to simple sentiment agent
            if not final_response:
                query_lower = query.lower()
                is_trading_query = any(
                    word in query_lower
                    for word in [
                        "buy",
                        "sell",
                        "hold",
                        "trading",
                        "recommendation",
                        "should i",
                        "analyze",
                        "price trend",
                    ]
                )

                if not is_trading_query:
                    # For sentiment-only queries, use simple sentiment agent
                    print("📊 Detected sentiment-only query, using simple sentiment agent")
                    from .agent import SentimentAgent

                    simple_agent = SentimentAgent()
                    final_response = await simple_agent.invoke(query, session_id)
                else:
                    # For trading queries, return error if no response
                    final_response = json.dumps(
                        {
                            "type": "sentiment_trading",
                            "error": "No response generated from agent. Please try again.",
                            "success": False,
                        },
                        indent=2,
                    )

            # Validate and send response
            if final_response:
                print(f"\n🔧 Processing final response for output...")
                print(f"   📏 Original response length: {len(final_response)}")
                
                # Try to extract JSON from response if it's embedded in text
                # The trading analysis agent might output text with JSON embedded
                json_match = None
                import re

                # Look for JSON objects in the response - improved pattern to handle nested objects
                # First, try to find JSON wrapped in ```json ... ``` code blocks
                json_code_block_pattern = r"```json\s*(\{.*?\})\s*```"
                json_code_blocks = re.findall(json_code_block_pattern, final_response, re.DOTALL)
                if json_code_blocks:
                    print(f"   🔍 Found {len(json_code_blocks)} JSON code blocks")
                    for i, block in enumerate(json_code_blocks):
                        try:
                            parsed = json.loads(block)
                            json_match = block
                            print(f"   ✅ Extracted valid JSON from code block #{i+1} (length: {len(block)})")
                            break
                        except json.JSONDecodeError as e:
                            print(f"   ⚠️  Code block #{i+1} is not valid JSON: {e}")

                # If no code block JSON, try to find JSON objects directly
                if not json_match:
                    # Improved pattern to match nested JSON objects more accurately
                    json_pattern = r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}"
                    json_matches = re.findall(json_pattern, final_response, re.DOTALL)
                    if json_matches:
                        print(f"   🔍 Found {len(json_matches)} potential JSON objects")
                        # Try to parse the last (likely most complete) JSON match
                        for i, match in enumerate(reversed(json_matches)):
                            try:
                                parsed = json.loads(match)
                                json_match = match
                                print(f"   ✅ Extracted valid JSON object #{len(json_matches)-i} (length: {len(match)})")
                                print(f"   📋 JSON keys: {list(parsed.keys()) if isinstance(parsed, dict) else 'N/A'}")
                                break
                            except json.JSONDecodeError as e:
                                print(f"   ⚠️  JSON match #{len(json_matches)-i} is not valid: {str(e)[:100]}")

                # Use extracted JSON if found, otherwise use full response
                response_to_send = json_match if json_match else final_response
                print(f"   📤 Response to send length: {len(response_to_send)}")
                if json_match:
                    print(f"   ✅ Using extracted JSON (saved {len(final_response) - len(json_match)} chars)")
                else:
                    print(f"   ⚠️  No JSON extracted, using full response")

                # Try to parse as JSON, if not, wrap it
                try:
                    parsed_response = json.loads(response_to_send)
                    # If it's already valid JSON, use it as-is
                    final_response = response_to_send
                    print(f"   ✅ Response is valid JSON")
                    if isinstance(parsed_response, dict):
                        print(f"   📊 JSON structure: {list(parsed_response.keys())}")
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"   ⚠️  Response is not valid JSON: {str(e)[:200]}")
                    # Check if response looks like it should be JSON but isn't
                    # (e.g., contains "recommendation", "confidence", etc.)
                    if any(
                        keyword in final_response.lower()
                        for keyword in ["recommendation", "confidence", "buy", "sell", "hold"]
                    ):
                        print(f"   🔍 Response contains trading keywords, wrapping in JSON structure")
                        # Try to construct a proper response from the text
                        # Extract key information if possible
                        recommendation = None
                        for rec in ["BUY", "SELL", "HOLD"]:
                            if rec in final_response.upper():
                                recommendation = rec
                                break

                        final_response = json.dumps(
                            {
                                "type": "trading_recommendation",
                                "response": final_response,
                                "recommendation": recommendation,
                                "success": True,
                            },
                            indent=2,
                        )
                        print(f"   ✅ Wrapped response in trading_recommendation JSON")
                    else:
                        # Wrap text response in JSON
                        final_response = json.dumps(
                            {
                                "type": "sentiment_trading",
                                "response": final_response,
                                "success": True,
                            },
                            indent=2,
                        )
                        print(f"   ✅ Wrapped response in sentiment_trading JSON")

                await event_queue.enqueue_event(new_agent_text_message(final_response))
                print(f"\n✅ Successfully enqueued orchestrated response")
                print(f"   📏 Final output length: {len(final_response)}")
                print(f"   📄 Final output preview: {final_response[:300]}...\n")
            else:
                error_response = _build_execution_error_response(
                    Exception("No response generated from agent")
                )
                await event_queue.enqueue_event(new_agent_text_message(error_response))

        except Exception as e:
            print(f"❌ Error in orchestrated execute: {e}")
            import traceback

            traceback.print_exc()
            error_response = _build_execution_error_response(e)
            await event_queue.enqueue_event(new_agent_text_message(error_response))

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        """Cancel execution (not supported)."""
        raise Exception(ERROR_CANCEL_NOT_SUPPORTED)
