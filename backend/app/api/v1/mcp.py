import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.mcp.server import mcp_server

logger = logging.getLogger("coderefactor.api.mcp")

router = APIRouter(prefix="/mcp", tags=["Model Context Protocol (MCP)"])


class ToolExecuteRequest(BaseModel):
    tool_name: str = Field(..., description="Name of the MCP tool to execute")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Arguments dictionary matching the tool's input schema")


class PromptGenerateRequest(BaseModel):
    prompt_name: str = Field(..., description="Name of the MCP prompt workflow")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Arguments dictionary for the prompt")


@router.get("/status")
async def get_mcp_status():
    """Returns the operational status, transport capabilities, and inventory of the MCP server."""
    tools = await mcp_server.list_tools()
    resources = await mcp_server.list_resources()
    templates = await mcp_server.list_resource_templates()
    prompts = await mcp_server.list_prompts()

    return {
        "status": "online",
        "service": "CodeRefactor AI MCP Server",
        "version": "1.0.0",
        "protocol_version": "2024-11-05",
        "transports": {
            "stdio": {
                "available": True,
                "command": "python -m app.mcp.server --transport stdio",
                "client_examples": ["Claude Desktop", "Cursor IDE", "Antigravity IDE", "Claude Code"],
            },
            "sse": {
                "available": True,
                "endpoint": "/mcp/sse",
                "messages_endpoint": "/mcp/messages",
                "client_examples": ["Remote Agents", "Web Dashboards", "Streamable HTTP Clients"],
            },
        },
        "inventory": {
            "tools_count": len(tools),
            "resources_count": len(resources) + len(templates),
            "prompts_count": len(prompts),
        },
    }


@router.get("/tools")
async def list_mcp_tools():
    """Lists all registered MCP tools and their parameter schemas."""
    tools = await mcp_server.list_tools()
    return [
        {
            "name": t.name,
            "description": t.description,
            "input_schema": t.input_schema,
        }
        for t in tools
    ]


@router.get("/resources")
async def list_mcp_resources():
    """Lists static resources and parameterized resource templates."""
    resources = await mcp_server.list_resources()
    templates = await mcp_server.list_resource_templates()

    items = []
    for r in resources:
        items.append({
            "type": "static",
            "name": r.name,
            "uri": str(r.uri),
            "description": getattr(r, "description", None),
        })

    for t in templates:
        items.append({
            "type": "template",
            "name": t.name,
            "uri": t.uri_template,
            "description": getattr(t, "description", None),
        })

    return items


@router.get("/prompts")
async def list_mcp_prompts():
    """Lists pre-engineered prompt workflows and their required arguments."""
    prompts = await mcp_server.list_prompts()
    result = []
    for p in prompts:
        args = []
        if hasattr(p, "arguments") and p.arguments:
            for a in p.arguments:
                args.append({
                    "name": a.name,
                    "description": a.description,
                    "required": a.required,
                })
        result.append({
            "name": p.name,
            "description": p.description,
            "arguments": args,
        })
    return result


@router.post("/execute")
async def execute_mcp_tool(req: ToolExecuteRequest):
    """Executes an MCP tool and returns the response for live testing and UI interactions."""
    try:
        call_res = await mcp_server.call_tool(req.tool_name, req.arguments)

        # Attempt to parse output content as JSON if available
        parsed_content = None
        raw_text = ""
        if call_res.content and len(call_res.content) > 0:
            raw_text = call_res.content[0].text
            try:
                parsed_content = json.loads(raw_text)
            except Exception:
                parsed_content = raw_text

        return {
            "success": not getattr(call_res, "is_error", False),
            "tool_name": req.tool_name,
            "arguments": req.arguments,
            "raw_text": raw_text,
            "result": parsed_content if parsed_content is not None else getattr(call_res, "structured_content", None),
        }
    except Exception as e:
        logger.exception("Error executing MCP tool '%s'", req.tool_name)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to execute tool '{req.tool_name}': {str(e)}",
        )


@router.get("/read-resource")
async def read_mcp_resource(uri: str = Query(..., description="URI of the resource to read")):
    """Reads an MCP resource by URI."""
    try:
        contents = await mcp_server.read_resource(uri)
        if not contents:
            raise HTTPException(status_code=404, detail="Resource empty or not found")

        first = contents[0]
        raw_text = first.content
        parsed = None
        try:
            parsed = json.loads(raw_text)
        except Exception:
            parsed = raw_text

        return {
            "uri": uri,
            "mime_type": first.mime_type,
            "data": parsed,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error reading MCP resource '%s'", uri)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read resource '{uri}': {str(e)}",
        )


@router.post("/generate-prompt")
async def generate_mcp_prompt(req: PromptGenerateRequest):
    """Generates a prompt messages payload from an MCP prompt template."""
    try:
        p_res = await mcp_server.get_prompt(req.prompt_name, req.arguments)
        messages = []
        for m in p_res.messages:
            messages.append({
                "role": m.role,
                "content": m.content.text if hasattr(m.content, "text") else str(m.content),
            })
        return {
            "prompt_name": req.prompt_name,
            "arguments": req.arguments,
            "messages": messages,
        }
    except Exception as e:
        logger.exception("Error generating MCP prompt '%s'", req.prompt_name)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate prompt '{req.prompt_name}': {str(e)}",
        )
