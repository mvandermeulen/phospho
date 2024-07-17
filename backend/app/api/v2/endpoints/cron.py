from fastapi import APIRouter, Header, Request
from fastapi_simple_rate_limiter import rate_limiter

from loguru import logger
from app.services.mongo.extractor import ExtractorClient
from app.security.authorization import get_quota
from app.core import config
from app.services.mongo.cron import fetch_projects_to_sync
from app.services.mongo.cron import (
    fetch_and_decrypt_langfuse_credentials,
)
from typing import Dict

router = APIRouter(tags=["cron"])


@router.post(
    "/cron/sync_pipeline",
    description="Run the synchronisation pipeline for Langsmith and Langfuse",
    response_model=Dict,
)
@rate_limiter(limit=2, seconds=60)
async def run_sync_pipeline(
    request: Request,
    key: str | None = Header(default=None),
):
    if key != config.CRON_SECRET_KEY:
        return {"status": "error", "message": "Invalid secret key"}
    try:
        await run_langsmith_sync_pipeline()
        await run_langfuse_sync_pipeline()
        return {"status": "ok", "message": "Pipeline ran successfully"}
    except Exception as e:
        return {"status": "error", "message": f"Error running sync pipeline {e}"}


async def run_langsmith_sync_pipeline():
    logger.debug("Running Langsmith synchronisation pipeline")

    projects_ids = await fetch_projects_to_sync(type="langsmith")

    extractor_client = ExtractorClient()
    for project_id in projects_ids:
        usage_quota = await get_quota(project_id)

        await extractor_client.collect_langsmith_data(
            project_id=project_id,
            org_id=usage_quota.org_id,
            langsmith_api_key=None,
            langsmith_project_name=None,
            current_usage=usage_quota.current_usage,
            max_usage=usage_quota.max_usage,
        )

    return {"status": "ok", "message": "Pipeline ran successfully"}


async def run_langfuse_sync_pipeline():
    logger.debug("Running Langfuse synchronisation pipeline")

    projects_ids = await fetch_projects_to_sync(type="langfuse")

    extractor_client = ExtractorClient()
    for project_id in projects_ids:
        langfuse_credentials = await fetch_and_decrypt_langfuse_credentials(project_id)

        usage_quota = await get_quota(project_id)
        current_usage = usage_quota.current_usage
        max_usage = usage_quota.max_usage

        await extractor_client.collect_langfuse_data(
            project_id=project_id,
            org_id=usage_quota.org_id,
            langfuse_credentials=langfuse_credentials,
            current_usage=current_usage,
            max_usage=max_usage,
        )

    return {"status": "ok", "message": "Pipeline ran successfully"}
