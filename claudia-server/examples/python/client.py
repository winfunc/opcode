#!/usr/bin/env python3

"""
Python example client for Claudia Server

This example demonstrates:
- Starting a Claude session
- Real-time streaming via WebSocket
- Handling different message types
- Error handling
"""

import asyncio
import json
import os
import sys
import signal
import aiohttp
import websockets
from typing import Optional

class ClaudiaClient:
    def __init__(self, server_url: str = None):
        """
        Initialize a ClaudiaClient.
        
        If server_url is not provided, reads CLAUDIA_SERVER_URL from the environment and defaults to "http://localhost:3000".
        Derives the WebSocket URL by replacing the HTTP scheme with "ws" and appending "/ws", and initializes session and websocket attributes.
        
        Parameters:
            server_url (str, optional): Base URL of the Claudia Server (e.g. "http://localhost:3000"). If omitted, the
                CLAUDIA_SERVER_URL environment variable is used; if that is unset, "http://localhost:3000" is used.
        """
        self.server_url = server_url or os.environ.get('CLAUDIA_SERVER_URL', 'http://localhost:3000')
        self.ws_url = self.server_url.replace('http', 'ws') + '/ws'
        self.session = None
        self.websocket = None

    async def __aenter__(self):
        """
        Enter async context: create an aiohttp ClientSession and return the client instance.
        
        Initializes and stores an aiohttp.ClientSession on self.session for use by other methods. Returns self so the class can be used as an asynchronous context manager.
        """
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """
        Close the client's HTTP session and WebSocket when exiting the async context manager.
        
        If an HTTP session or WebSocket is open, they are closed asynchronously. The method does not suppress exceptions raised in the managed block (it returns None).
        """
        if self.session:
            await self.session.close()
        if self.websocket:
            await self.websocket.close()

    async def start_session(self, project_path: str, prompt: str, model: str = 'claude-3-5-sonnet-20241022') -> str:
        """
        Start a new Claude session on the configured Claudia Server.
        
        Sends a POST to /api/claude/execute with the project path, prompt, and model.
        On success returns the created session's ID. On non-200 responses raises an
        Exception with the server-provided error message.
        
        Parameters:
            project_path (str): Filesystem path of the project to run the prompt against.
            prompt (str): The text prompt to send to Claude.
            model (str): Model identifier to use for the session (defaults to 'claude-3-5-sonnet-20241022').
        
        Returns:
            str: The newly created session_id.
        
        Raises:
            Exception: If the server responds with a non-200 status; message includes server error.
        """
        url = f"{self.server_url}/api/claude/execute"
        data = {
            'project_path': project_path,
            'prompt': prompt,
            'model': model
        }

        async with self.session.post(url, json=data) as response:
            if response.status != 200:
                error = await response.json()
                raise Exception(f"Failed to start session: {error['error']}")
            
            result = await response.json()
            return result['data']['session_id']

    async def connect_websocket(self, session_id: str):
        """
        Establish a WebSocket connection to the server, subscribe to a session, and stream incoming messages to the message handler.
        
        Opens a connection to self.ws_url and stores the WebSocket in self.websocket, sends a JSON subscribe message for the given session, then iterates over incoming text messages, parsing each as JSON and delegating to self.handle_message. JSON parsing errors and handler exceptions are caught and logged; connection errors from establishing the WebSocket may propagate.
        Parameters:
            session_id (str): The server session identifier to subscribe to.
        """
        self.websocket = await websockets.connect(self.ws_url)
        print("📡 Connected to WebSocket")

        # Subscribe to session
        subscribe_message = {
            'type': 'subscribe',
            'session_id': session_id
        }
        await self.websocket.send(json.dumps(subscribe_message))

        # Start listening for messages
        async for message in self.websocket:
            try:
                data = json.loads(message)
                await self.handle_message(data)
            except json.JSONDecodeError as e:
                print(f"Failed to parse WebSocket message: {e}")
            except Exception as e:
                print(f"Error handling message: {e}")

    async def handle_message(self, message: dict):
        """
        Dispatch and process a single incoming WebSocket message from the server.
        
        Recognizes message types in the `message['type']` field:
        - "status": prints a short status line from `message['data']['status']`.
        - "claude_stream": forwards `message['data']` to `handle_claude_stream` for streaming output handling.
        - "error": prints the error text from `message['data']['error']`.
        - any other value: prints an "unknown message type" notice.
        
        Parameters:
            message (dict): Parsed JSON message with at least a `type` key and a `data` payload whose structure depends on `type`.
        """
        message_type = message.get('type')
        
        if message_type == 'status':
            print(f"📊 Status: {message['data']['status']}")
        elif message_type == 'claude_stream':
            await self.handle_claude_stream(message['data'])
        elif message_type == 'error':
            print(f"❌ Error: {message['data']['error']}")
        else:
            print(f"📩 Unknown message type: {message_type}")

    async def handle_claude_stream(self, data: dict):
        """
        Handle incoming Claude streaming events and render them to stdout.
        
        The `data` payload is a dictionary that must include a 'type' field indicating the stream event:
        - 'start'    : indicates the model has begun producing a response; prints a start notice.
        - 'partial'  : contains incremental text under 'content'; prints text without a trailing newline to stream output progressively.
        - 'complete' : signals the end of the response; prints a newline and a completion notice.
        - 'error'    : contains an error message under 'content'; prints the error with a leading newline.
        - other      : prints the provided 'content' (or the full payload) as a generic Claude output.
        
        This function has no return value; it side-effects by printing to stdout.
        """
        stream_type = data.get('type')
        
        if stream_type == 'start':
            print("🤖 Claude started responding...")
        elif stream_type == 'partial':
            # Stream the content as it comes
            content = data.get('content', '')
            if content:
                print(content, end='', flush=True)
        elif stream_type == 'complete':
            print("\\n✅ Claude completed response")
        elif stream_type == 'error':
            print(f"\\n❌ Claude error: {data.get('content', '')}")
        else:
            print(f"\\n📝 Claude output: {data.get('content', data)}")

    async def get_running_sessions(self) -> list:
        """
        Return the list of currently running Claude sessions.
        
        Returns:
            list: Session objects parsed from the server response `data` field.
        
        Raises:
            Exception: If the server responds with a non-200 status; message is taken from the server's `error` field.
        """
        url = f"{self.server_url}/api/claude/sessions/running"
        
        async with self.session.get(url) as response:
            if response.status != 200:
                error = await response.json()
                raise Exception(f"Failed to get running sessions: {error['error']}")
            
            result = await response.json()
            return result['data']

    async def cancel_session(self, session_id: str) -> bool:
        """
        Cancel a running Claude session on the server.
        
        Sends a POST request to /api/claude/cancel/{session_id} and returns whether the session was successfully cancelled.
        
        Parameters:
            session_id (str): The server-side identifier of the session to cancel.
        
        Returns:
            bool: True if the server reports the session was cancelled, False otherwise.
        
        Raises:
            Exception: If the HTTP response status is not 200; the exception message contains the server-provided error.
        """
        url = f"{self.server_url}/api/claude/cancel/{session_id}"
        
        async with self.session.post(url) as response:
            if response.status != 200:
                error = await response.json()
                raise Exception(f"Failed to cancel session: {error['error']}")
            
            result = await response.json()
            return result['data']['cancelled']

    async def check_health(self) -> dict:
        """
        Check the Claudia Server health status.
        
        Performs a GET request to the server's /api/status/health endpoint and returns the parsed JSON health payload on success.
        
        Returns:
            dict: The JSON response body describing server health.
        
        Raises:
            Exception: If the server responds with a non-200 status code.
        """
        url = f"{self.server_url}/api/status/health"
        
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception("Server is not healthy")
            
            return await response.json()

async def example():
    """
    Run a self-contained example demonstrating ClaudiaClient usage.
    
    This coroutine exercises the end-to-end flow against a Claudia Server:
    - Opens a ClaudiaClient session context.
    - Verifies server health.
    - Uses the current working directory as the project path.
    - Starts a Claude session with a sample prompt and model, printing the returned session ID.
    - Connects to the server WebSocket to stream real-time responses until interrupted.
    
    Handles KeyboardInterrupt by printing a shutdown message; on other exceptions it prints the error and exits the process with code 1.
    """
    async with ClaudiaClient() as client:
        try:
            # Check if server is healthy
            health = await client.check_health()
            print("✅ Server is healthy")

            # Get current directory as project path
            project_path = os.getcwd()
            print(f"📁 Using project path: {project_path}")

            # Start a new Claude session
            print("🚀 Starting Claude session...")
            session_id = await client.start_session(
                project_path,
                "Help me understand the structure of this project and suggest improvements.",
                "claude-3-5-sonnet-20241022"
            )
            print(f"🎯 Session started: {session_id}")

            # Connect WebSocket for real-time streaming
            print("👂 Listening for Claude responses... (Press Ctrl+C to exit)")
            await client.connect_websocket(session_id)

        except KeyboardInterrupt:
            print("\\n🛑 Shutting down...")
        except Exception as error:
            print(f"❌ Error: {error}")
            sys.exit(1)

if __name__ == "__main__":
    # Handle graceful shutdown
    def signal_handler(sig, frame):
        """
        Handle an OS signal by printing a shutdown message and exiting the process with status code 0.
        
        Parameters:
            sig: Signal number received.
            frame: Current stack frame (unused).
        """
        print("\\n🛑 Shutting down...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    
    # Run the example
    asyncio.run(example())