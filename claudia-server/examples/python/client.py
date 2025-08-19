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
        self.server_url = server_url or os.environ.get('CLAUDIA_SERVER_URL', 'http://localhost:3000')
        self.ws_url = self.server_url.replace('http', 'ws') + '/ws'
        self.session = None
        self.websocket = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
        if self.websocket:
            await self.websocket.close()

    async def start_session(self, project_path: str, prompt: str, model: str = 'claude-3-5-sonnet-20241022') -> str:
        """Start a new Claude session"""
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
        """Connect to WebSocket and subscribe to session"""
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
        """Handle incoming WebSocket messages"""
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
        """Handle Claude streaming messages"""
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
        """Get list of running sessions"""
        url = f"{self.server_url}/api/claude/sessions/running"
        
        async with self.session.get(url) as response:
            if response.status != 200:
                error = await response.json()
                raise Exception(f"Failed to get running sessions: {error['error']}")
            
            result = await response.json()
            return result['data']

    async def cancel_session(self, session_id: str) -> bool:
        """Cancel a session"""
        url = f"{self.server_url}/api/claude/cancel/{session_id}"
        
        async with self.session.post(url) as response:
            if response.status != 200:
                error = await response.json()
                raise Exception(f"Failed to cancel session: {error['error']}")
            
            result = await response.json()
            return result['data']['cancelled']

    async def check_health(self) -> dict:
        """Check server health"""
        url = f"{self.server_url}/api/status/health"
        
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception("Server is not healthy")
            
            return await response.json()

async def example():
    """Example usage"""
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
        print("\\n🛑 Shutting down...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    
    # Run the example
    asyncio.run(example())