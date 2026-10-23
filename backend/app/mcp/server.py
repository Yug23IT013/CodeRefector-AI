import sys
import argparse
import asyncio
import logging
from mcp.server.mcpserver import MCPServer
from app.mcp.tools import register_tools
from app.mcp.resources import register_resources
from app.mcp.prompts import register_prompts

logger = logging.getLogger("coderefactor.mcp")


def create_mcp_server() -> MCPServer:
    """Factory creating and configuring the CodeRefactor AI MCPServer instance."""
    server = MCPServer(
        name="CodeRefactor AI",
        version="1.0.0",
        instructions=(
            "CodeRefactor AI Model Context Protocol Server. "
            "Exposes AST-based static analysis (Python & JS/TS), RAG vector knowledge base queries, "
            "repository health metrics, PR findings, benchmark analysis, and enterprise code review tools."
        ),
    )
    register_tools(server)
    register_resources(server)
    register_prompts(server)
    return server


# Global singleton MCPServer instance for CodeRefactor AI
mcp_server = create_mcp_server()


def main():
    """CLI entry point for running the CodeRefactor MCP server."""
    parser = argparse.ArgumentParser(description="CodeRefactor AI MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="Transport protocol (default: stdio)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port for SSE transport (default: 8001)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr,  # IMPORTANT: Logs must go to stderr for stdio transport
    )

    if args.transport == "stdio":
        logger.info("Starting CodeRefactor AI MCP server via stdio transport...")
        asyncio.run(mcp_server.run_stdio_async())
    elif args.transport == "sse":
        logger.info(f"Starting CodeRefactor AI MCP server via SSE transport on port {args.port}...")
        asyncio.run(mcp_server.run_sse_async())


if __name__ == "__main__":
    main()
